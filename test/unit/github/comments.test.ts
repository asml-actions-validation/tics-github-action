import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { logger } from '../../../src/helper/logger';
import { deletePreviousComments, getPostedComments, postComment } from '../../../src/github/comments';
import { Comment } from '../../../src/github/interfaces';
import { octokit } from '../../../src/github/octokit';
import { githubConfig } from '../../../src/configuration/config';
import { githubConfigMock } from '../../.setup/mock';

describe('getPostedReviewComments', () => {
  const octokitSpy = jest.spyOn(octokit, 'paginate');

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should throw error when a pullRequestNumber is not present', async () => {
    githubConfigMock.pullRequestNumber = undefined;

    let err: any;
    try {
      await getPostedComments();

      expect(false).toBeTruthy(); // should not be reached
    } catch (error) {
      err = error;
    }

    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe('This function can only be run on a pull request.');
  });

  it('should return single file on getPostedReviewComments', async () => {
    githubConfigMock.pullRequestNumber = 1;
    octokitSpy.mockResolvedValue([{ id: 1 }]);

    const response = await getPostedComments();

    expect(response).toEqual([{ id: 1 }]);
  });

  it('should be called with specific parameters on getPostedReviewComments', async () => {
    octokitSpy.mockResolvedValue([]);
    const spy = jest.spyOn(octokit, 'paginate');

    await getPostedComments();

    expect(spy).toHaveBeenCalledWith(octokit.rest.issues.listComments, { repo: 'test', owner: 'tester', issue_number: 1 });
  });

  it('should return three files on getPostedReviewComments', async () => {
    octokitSpy.mockResolvedValue([{}, {}, {}]);

    const response = await getPostedComments();

    expect(response as any[]).toHaveLength(3);
  });

  it('should post a notice on when octokit throws', async () => {
    const spy = jest.spyOn(logger, 'notice');
    octokitSpy.mockImplementationOnce(() => {
      throw new Error();
    });
    await getPostedComments();

    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('postComment', () => {
  let postCommentSpy: jest.SpiedFunction<typeof octokit.rest.issues.createComment>;

  beforeEach(() => {
    postCommentSpy = jest.spyOn(octokit.rest.issues, 'createComment');
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should throw error when a pullRequestNumber is not present', async () => {
    githubConfigMock.pullRequestNumber = undefined;

    let error: any;
    try {
      await postComment('Comment body...');
    } catch (err) {
      error = err;
    }

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('This function can only be run on a pull request.');
  });

  it('should call createComment once', async () => {
    githubConfigMock.pullRequestNumber = 1;

    await postComment('Comment body...');

    expect(postCommentSpy).toHaveBeenCalledTimes(1);
  });

  it('should call createComment with values', async () => {
    await postComment('Comment body...');
    const calledWith = {
      owner: githubConfig.owner,
      repo: githubConfig.reponame,
      issue_number: 1,
      body: 'Comment body...'
    };

    expect(postCommentSpy).toHaveBeenCalledWith(calledWith);
  });

  it('should post a notice when createComment throws', async () => {
    postCommentSpy.mockRejectedValue(Error());
    const noticeSpy = jest.spyOn(logger, 'notice');

    await postComment('Comment body...');

    expect(noticeSpy).toHaveBeenCalledTimes(1);
  });
});

describe('deletePreviousComments', () => {
  let deleteCommentSpy: any;

  beforeEach(() => {
    deleteCommentSpy = jest.spyOn(octokit.rest.issues, 'deleteComment');
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should call deleteComment once', async () => {
    await deletePreviousComments([commentWithBody]);

    expect(deleteCommentSpy).toHaveBeenCalledTimes(1);
  });

  it('should call deleteComment twice', async () => {
    await deletePreviousComments([commentWithBody, commentWithBody]);

    expect(deleteCommentSpy).toHaveBeenCalledTimes(2);
  });

  it('Should call deleteComment with values', async () => {
    await deletePreviousComments([commentWithBody]);
    const calledWith = {
      owner: githubConfig.owner,
      repo: githubConfig.reponame,
      comment_id: 0
    };

    expect(deleteCommentSpy).toHaveBeenCalledWith(calledWith);
  });

  it('Should not call deleteComment if body is undefined', async () => {
    await deletePreviousComments([commentWithoutBody]);

    expect(deleteCommentSpy).toHaveBeenCalledTimes(0);
  });

  it('Should not call deleteComment if body is not TICS', async () => {
    await deletePreviousComments([commentWithoutTics]);
    expect(deleteCommentSpy).toHaveBeenCalledTimes(0);
  });

  it('Should call deleteComment if identifier workflow and job match', async () => {
    await deletePreviousComments([commentWithIdentifierSameJob]);
    const calledWith = {
      owner: githubConfig.owner,
      repo: githubConfig.reponame,
      comment_id: 0
    };
    expect(deleteCommentSpy).toHaveBeenCalledWith(calledWith);
  });

  it('Should not call deleteComment if identifier workflow and job match, but they are in the same run', async () => {
    await deletePreviousComments([commentWithIdentifierSameJobAndRun]);
    expect(deleteCommentSpy).toHaveBeenCalledTimes(0);
  });

  it('Should not call deleteComment if identifier workflow and job do not match', async () => {
    await deletePreviousComments([commentWithIdentifierOtherJob]);
    expect(deleteCommentSpy).toHaveBeenCalledTimes(0);
  });

  it('Should not call deleteComment if identifier is of the wrong format', async () => {
    const debugSpy = jest.spyOn(logger, 'debug');

    await deletePreviousComments([commentWithIdentifierWrongFormat]);

    expect(deleteCommentSpy).toHaveBeenCalledTimes(0);
    expect(debugSpy).toHaveBeenCalledTimes(1);
    expect(debugSpy).toHaveBeenCalledWith('Identifier is not of the correct format: tics-client_OTHER_1');
  });

  it('Should post a notice when deleteComment throws', async () => {
    deleteCommentSpy.mockRejectedValue(Error());
    const noticeSpy = jest.spyOn(logger, 'notice');

    await deletePreviousComments([commentWithBody]);

    expect(noticeSpy).toHaveBeenCalledTimes(1);
  });
});

const commentWithBody: Comment = {
  url: '',
  html_url: '',
  issue_url: '',
  id: 0,
  node_id: '',
  user: null,
  created_at: '',
  updated_at: '',
  body: '<h1>TICS Quality Gate</h1>'
};

const commentWithoutBody: Comment = {
  ...commentWithBody,
  body: undefined
};

const commentWithoutTics: Comment = {
  ...commentWithBody,
  body: 'Other action content'
};

const commentWithIdentifierSameJob: Comment = {
  ...commentWithBody,
  body: '<h1>TICS Quality Gate</h1><!--This distracts-->Message Here<!--tics-client_TICS_1_1-->'
};

const commentWithIdentifierSameJobAndRun: Comment = {
  ...commentWithBody,
  body: '<h1>TICS Quality Gate</h1>Message Here<!--tics-client_TICS_1_2-->'
};

const commentWithIdentifierOtherJob: Comment = {
  ...commentWithBody,
  body: '<h1>TICS Quality Gate</h1>Message Here<!--tics-client_OTHER_1_1-->'
};

const commentWithIdentifierWrongFormat: Comment = {
  ...commentWithBody,
  body: '<h1>TICS Quality Gate</h1>Message Here<!--tics-client_OTHER_1-->'
};

import { logger } from '../helper/logger';
import { githubConfig, octokit } from '../configuration';
import { ReviewComment } from './interfaces';
import { ReviewComments } from '../helper/interfaces';

/**
 * Gets a list of all reviews posted on the pull request.
 * @returns List of reviews posted on the pull request.
 */
export async function getPostedReviewComments(): Promise<ReviewComment[]> {
  let response: ReviewComment[] = [];
  try {
    logger.info('Retrieving posted review comments.');
    const params = {
      owner: githubConfig.owner,
      repo: githubConfig.reponame,
      pull_number: githubConfig.pullRequestNumber
    };
    response = await octokit.paginate(octokit.rest.pulls.listReviewComments, params);
  } catch (error: unknown) {
    let message = 'reason unkown';
    if (error instanceof Error) message = error.message;
    logger.error(`Could not retrieve the review comments: ${message}`);
  }
  return response;
}

/**
 * Deletes the review comments of previous runs.
 * @param postedReviewComments Previously posted review comments.
 */
export function postAnnotations(reviewComments: ReviewComments): void {
  logger.header('Posting annotations.');
  reviewComments.postable.forEach(reviewComment => {
    logger.warning(reviewComment.body, {
      file: reviewComment.path,
      startLine: reviewComment.line,
      title: reviewComment.title
    });
  });
}

/**
 * Deletes the review comments of previous runs.
 * @param postedReviewComments Previously posted review comments.
 */
export function deletePreviousReviewComments(postedReviewComments: ReviewComment[]): void {
  logger.header('Deleting review comments of previous runs.');
  postedReviewComments.map(async reviewComment => {
    if (reviewComment.body.substring(0, 17) === ':warning: **TICS:') {
      try {
        const params = {
          owner: githubConfig.owner,
          repo: githubConfig.reponame,
          comment_id: reviewComment.id
        };
        await octokit.rest.pulls.deleteReviewComment(params);
      } catch (error: unknown) {
        let message = 'reason unkown';
        if (error instanceof Error) message = error.message;
        logger.error(`Could not delete review comment: ${message}`);
      }
    }
  });
  logger.info('Deleted review comments of previous runs.');
}
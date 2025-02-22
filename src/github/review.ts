import { logger } from '../helper/logger';
import { Events } from './enums';
import { handleOctokitError } from '../helper/response';
import { githubConfig } from '../configuration/config';
import { octokit } from './octokit';

/**
 * Create review on the pull request from the analysis given.
 * @param body Body containing the summary of the review
 * @param event Either approve or request changes in the review.
 */
export async function postReview(body: string, event: Events): Promise<void> {
  if (!githubConfig.pullRequestNumber) {
    throw Error('This function can only be run on a pull request.');
  }

  const params = {
    owner: githubConfig.owner,
    repo: githubConfig.reponame,
    pull_number: githubConfig.pullRequestNumber,
    event: event,
    body: body
  };

  try {
    logger.header('Posting a review for this pull request.');
    await octokit.rest.pulls.createReview(params);
    logger.info('Posted review for this pull request.');
  } catch (error: unknown) {
    const message = handleOctokitError(error);
    logger.notice(`Posting the review failed: ${message}`);
  }
}

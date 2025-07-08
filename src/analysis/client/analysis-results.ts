import { createReviewComments } from '../../action/decorate/summary';
import { actionConfig } from '../../configuration/config';
import { ChangedFile } from '../../github/interfaces';
import { AnalysisResult, ProjectResult } from '../../helper/interfaces';
import { getItemFromUrl, getProjectFromUrl } from '../../tics/url';
import { getAnalyzedFiles, getAnalyzedFilesUrl } from '../../viewer/analyzed-files';
import { getAnnotations } from '../../viewer/annotations';
import { getQualityGate, getQualityGateUrl } from '../../viewer/qualitygate';

/**
 * Retrieve all analysis results from the viewer in one convenient object.
 * @param explorerUrls All the explorer urls gotten from the TICS analysis.
 * @param changedFiles The changed files gotten from GitHub.
 * @returns Object containing the results of the analysis.
 */
export async function getClientAnalysisResults(explorerUrls: string[], changedFiles: ChangedFile[]): Promise<AnalysisResult> {
  const hasExplorerUrl = explorerUrls.length !== 0;
  const analysisResult: AnalysisResult = {
    passed: hasExplorerUrl,
    passedWithWarning: false,
    missesQualityGate: !hasExplorerUrl,
    projectResults: []
  };

  for (const url of explorerUrls) {
    const cdtoken = getItemFromUrl(url, 'ClientData');
    const project = getProjectFromUrl(url);

    const projectResult: ProjectResult = {
      project: project,
      explorerUrl: url,
      analyzedFiles: await getAnalyzedFiles(getAnalyzedFilesUrl(project, { cdtoken }))
    };

    projectResult.qualityGate = await getQualityGate(getQualityGateUrl(project, { cdtoken }));

    if (!projectResult.qualityGate.passed) {
      analysisResult.passed = false;
    }

    if (actionConfig.postAnnotations) {
      const annotations = await getAnnotations(projectResult.qualityGate.annotationsApiV1Links);
      if (annotations.length > 0) {
        projectResult.reviewComments = createReviewComments(annotations, changedFiles);
      }
    }

    analysisResult.projectResults.push(projectResult);
  }

  analysisResult.passedWithWarning =
    analysisResult.passed && analysisResult.projectResults.filter(p => p.qualityGate?.passed && p.qualityGate.passedWithWarning).length > 0;

  return analysisResult;
}

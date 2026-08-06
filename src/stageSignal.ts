export const STAGE_CHANGE_EVENT = "superneo:stage-change";

export type StageChangeDetail = {
  stage: number;
  previous: number;
};

export function dispatchStageChange(stage: number, previous: number) {
  window.dispatchEvent(new CustomEvent<StageChangeDetail>(STAGE_CHANGE_EVENT, {
    detail: { stage, previous },
  }));
}

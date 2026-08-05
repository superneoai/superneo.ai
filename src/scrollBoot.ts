export interface InitialScrollTarget {
  history: Pick<History, "scrollRestoration">;
  scrollTo(options?: ScrollToOptions): void;
}

export function resetInitialScroll(target: InitialScrollTarget) {
  target.history.scrollRestoration = "manual";
  target.scrollTo({ left: 0, top: 0, behavior: "auto" });
}

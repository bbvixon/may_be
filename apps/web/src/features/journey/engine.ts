import type { AnalyzeDecisionResponse, DecisionNode } from "@maybe/contracts";
import { analyzeDecision, expandNode } from "../../lib/api";

const SVG_NS = "http://www.w3.org/2000/svg";

type Branch = { id: string; label: string; detail: string };
type Decision = Branch & { branches?: Branch[] };
type HistoryEntry = {
  parentDecision: string;
  choice: string;
  level: number;
  parentX: number;
  chosenX: number;
};

type Elements = {
  phone: HTMLElement;
  meaningSpace: HTMLElement;
  passageCopy: HTMLElement;
  logo: HTMLElement;
  treeSvg: SVGSVGElement;
  graph: SVGGElement;
  hint: HTMLElement;
  undo: HTMLElement;
};

type Options = {
  elements: Elements;
  onError: (message: string | null) => void;
};

export type JourneyEngine = ReturnType<typeof createJourneyEngine>;

export function createJourneyEngine({ elements, onError }: Options) {
  const scenes = new Map<string, HTMLElement>();
  elements.phone.querySelectorAll<HTMLElement>("[data-scene]").forEach((scene) => {
    scenes.set(scene.dataset.scene!, scene);
  });

  let timers: number[] = [];
  let runToken = 0;
  let history: HistoryEntry[] = [];
  let decisions: Record<string, Decision> = {};
  let activeDecision = "root";
  let decisionId = "";
  let level = 0;
  let cameraX = 0;
  let cameraY = 240;
  let cameraScale = 1;
  let cameraFrame = 0;
  let locked = false;
  const expansionRequests = new Map<string, Promise<void>>();

  function later(fn: () => void, ms: number) {
    const id = window.setTimeout(fn, ms);
    timers.push(id);
    return id;
  }

  function clearTimers() {
    timers.forEach(window.clearTimeout);
    timers = [];
    cancelAnimationFrame(cameraFrame);
  }

  function show(name: string) {
    elements.phone.scrollTop = 0;
    scenes.forEach((scene, key) => scene.classList.toggle("active", key === name));
    requestAnimationFrame(() => { elements.phone.scrollTop = 0; });
  }

  function setViewBox(x: number, y: number, scale = cameraScale) {
    cameraX = x;
    cameraY = y;
    cameraScale = scale;
    elements.treeSvg.setAttribute("viewBox", `${x} ${y} ${430 * scale} ${840 * scale}`);
  }

  function animateCamera(toX: number, toY: number, toScale = 1, duration = 1800) {
    const fromX = cameraX;
    const fromY = cameraY;
    const fromScale = cameraScale;
    const started = performance.now();
    const ease = (value: number) => 1 - Math.pow(1 - value, 4);
    cancelAnimationFrame(cameraFrame);

    function frame(now: number) {
      const progress = Math.min(1, (now - started) / duration);
      const eased = ease(progress);
      setViewBox(
        fromX + (toX - fromX) * eased,
        fromY + (toY - fromY) * eased,
        fromScale + (toScale - fromScale) * eased,
      );
      if (progress < 1) cameraFrame = requestAnimationFrame(frame);
    }

    cameraFrame = requestAnimationFrame(frame);
  }

  function scaleFor(id: string) {
    const count = decisions[id]?.branches?.length ?? 2;
    if (count >= 5) return 1.55;
    if (count === 4) return 1.25;
    return 1;
  }

  function reset() {
    runToken += 1;
    clearTimers();
    history = [];
    decisions = {};
    expansionRequests.clear();
    activeDecision = "root";
    decisionId = "";
    level = 0;
    locked = false;
    elements.graph.innerHTML = "";
    elements.treeSvg.classList.remove("ready");
    setViewBox(0, 240, 1);
    elements.logo.className = "logo-stage";
    elements.passageCopy.classList.remove("fade");
    elements.meaningSpace.querySelectorAll(".keyword").forEach((item) => item.remove());
    elements.hint.textContent = "Hover to understand · touch to follow";
    elements.hint.className = "branch-caption";
    elements.undo.classList.remove("visible");
    onError(null);
    show("intro");
  }

  async function start(input: string) {
    if (locked) return;
    clearTimers();
    const token = ++runToken;
    locked = true;
    onError(null);
    show("listening");

    try {
      const [analysis] = await Promise.all([
        analyzeDecision({ input, locale: "en-IN" }),
        new Promise((resolve) => window.setTimeout(resolve, 1900)),
      ]);
      if (token !== runToken) return;
      loadAnalysis(analysis);
      showMeanings(analysis.keywords, token);
    } catch {
      if (token !== runToken) return;
      locked = false;
      onError("I couldn't reach the decision engine. Try once more.");
      show("intro");
    }
  }

  function loadAnalysis(analysis: AnalyzeDecisionResponse) {
    decisionId = analysis.graph.decisionId;
    const nodeMap = new Map(analysis.graph.nodes.map((node) => [node.id, node]));
    const rootNode = nodeMap.get(analysis.graph.rootNodeId)!;
    const rootBranches = analysis.graph.edges
      .filter((edge) => edge.from === rootNode.id)
      .map((edge) => nodeMap.get(edge.to))
      .filter((node): node is DecisionNode => Boolean(node))
      .map(toBranch);

    decisions.root = {
      id: "root",
      label: rootNode.label,
      detail: rootNode.summary,
      branches: rootBranches,
    };
    rootBranches.forEach((branch) => { decisions[branch.id] = { ...branch }; });
    elements.logo.querySelector("b")?.setAttribute("data-label", rootNode.label);
    prefetchNearby(rootBranches);
  }

  function showMeanings(keywords: string[], token: number) {
    show("meanings");
    const positions = [
      [50, 26], [25, 39], [72, 43], [31, 18], [67, 16], [50, 50], [18, 25], [82, 28],
    ];
    keywords.forEach((text, index) => {
      const bubble = document.createElement("span");
      bubble.className = "keyword";
      bubble.textContent = text;
      bubble.style.left = `${positions[index][0]}%`;
      bubble.style.top = `${positions[index][1]}%`;
      elements.meaningSpace.appendChild(bubble);
      later(() => bubble.classList.add("rise"), 160 + index * 430);
    });
    later(() => dissolveMeanings(token), 4450);
  }

  function dissolveMeanings(token: number) {
    elements.meaningSpace.querySelectorAll<HTMLElement>(".keyword").forEach((bubble, index) => {
      later(() => bubble.classList.add("dissolve"), index * 170);
    });
    later(() => {
      if (token !== runToken) return;
      show("passage");
      later(() => elements.passageCopy.classList.add("fade"), 2200);
      later(() => beginJourney(token), 4450);
    }, 1500);
  }

  function beginJourney(token: number) {
    if (token !== runToken) return;
    show("journey");
    elements.logo.className = "logo-stage";
    later(() => elements.logo.classList.add("appear"), 1900);
    later(() => elements.logo.classList.add("reduce"), 3700);
    later(() => elements.logo.classList.add("seed"), 3800);
    later(() => initTree(), 12000);
  }

  function svg(tag: string, attrs: Record<string, string | number> = {}) {
    const element = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, String(value)));
    return element;
  }

  function splitLabel(label: string) {
    const words = label.split(" ");
    if (label.length <= 11 || words.length === 1) return [label];
    if (words.length <= 3) return words;
    const cut = Math.ceil(words.length / 2);
    return [words.slice(0, cut).join(" "), words.slice(cut).join(" ")];
  }

  function addText(group: SVGElement, label: string, isCurrent = false) {
    const lines = splitLabel(label);
    const lineHeight = 20;
    const firstLineY = 1 - ((lines.length - 1) * lineHeight) / 2;
    const text = svg("text", {
      class: `svg-label${label.length > 16 ? " compact-label" : ""}`,
      "text-anchor": "middle",
      "dominant-baseline": "middle",
      y: firstLineY,
    });
    lines.forEach((line, index) => {
      const span = svg("tspan", { x: "0", dy: index === 0 ? "0" : lineHeight });
      span.textContent = line;
      text.appendChild(span);
    });
    if (isCurrent) text.classList.add("current-label");
    group.appendChild(text);
  }

  function createNode({
    id, label, detail, x, y, current = false, levelIndex = 0,
  }: Branch & { x: number; y: number; current?: boolean; levelIndex?: number }) {
    const outer = svg("g", {
      class: `svg-node ${current ? "current-node" : "choice-node"}`,
      transform: `translate(${x} ${y})`,
      "data-node-id": id,
      "data-level": levelIndex,
      "data-x": x,
      "data-detail": detail,
    });
    if (!current) {
      outer.setAttribute("data-choice", id);
      outer.setAttribute("role", "button");
      outer.setAttribute("tabindex", "0");
      outer.setAttribute("aria-label", `${label}. ${detail}`);
    }
    const shell = svg("g", { class: "node-shell" });
    shell.append(
      svg("circle", { class: "node-halo", r: current ? "75" : "66" }),
      svg("circle", { class: "node-circle", r: current ? "62" : "55", filter: "url(#nodeShadow)" }),
    );
    addText(shell, label, current);
    outer.appendChild(shell);
    elements.graph.appendChild(outer);
    return outer;
  }

  function branchXs(count: number, parentX: number) {
    const spacing = count >= 5 ? 130 : count === 4 ? 140 : count === 3 ? 150 : 216;
    return Array.from({ length: count }, (_, index) => parentX + (index - (count - 1) / 2) * spacing);
  }

  function pathD(x1: number, y1: number, x2: number, y2: number) {
    const control = y1 - (y1 - y2) * 0.5;
    return `M ${x1} ${y1 - 57} C ${x1} ${control}, ${x2} ${control}, ${x2} ${y2 + 52}`;
  }

  function addBranches(id: string, levelIndex: number, parentX: number) {
    const data = decisions[id];
    if (!data?.branches?.length) return;
    const parentY = 660 - levelIndex * 430;
    const childY = parentY - 430;
    const xs = branchXs(data.branches.length, parentX);
    const layer = svg("g", { class: "branch-level", "data-branch-level": levelIndex });
    data.branches.forEach((_, index) => {
      const path = svg("path", { class: "branch-line", d: pathD(parentX, parentY, xs[index], childY) });
      path.style.setProperty("--delay", `${index * 0.12}s`);
      layer.appendChild(path);
    });
    elements.graph.insertBefore(layer, elements.graph.firstChild);
    data.branches.forEach((branch, index) => {
      const node = createNode({ ...branch, x: xs[index], y: childY, levelIndex });
      node.style.setProperty("--delay", `${0.55 + index * 0.12}s`);
    });
    requestAnimationFrame(() => layer.classList.add("draw"));
  }

  function initTree() {
    const root = decisions.root;
    if (!root) return;
    elements.graph.innerHTML = "";
    createNode({ ...root, x: 215, y: 660, current: true, levelIndex: 0 });
    elements.treeSvg.classList.add("ready");
    elements.logo.classList.add("hidden");
    addBranches("root", 0, 215);
    animateCamera(0, 0, scaleFor("root"), 1900);
    later(() => {
      elements.hint.classList.add("visible");
      locked = false;
    }, 1400);
  }

  async function ensureBranches(id: string) {
    if (decisions[id]?.branches?.length) return;
    const pending = expansionRequests.get(id);
    if (pending) return pending;
    const request = expandNode({ decisionId, nodeId: id })
      .then((expansion) => {
        decisions[id] = {
          ...decisions[id],
          branches: expansion.nodes.map(toBranch),
        };
        expansion.nodes.forEach((node) => {
          decisions[node.id] = { ...toBranch(node) };
        });
      })
      .finally(() => expansionRequests.delete(id));
    expansionRequests.set(id, request);
    return request;
  }

  function prefetchNearby(branches: Branch[] = []) {
    branches.slice(0, 3).forEach((branch) => {
      void ensureBranches(branch.id).catch(() => undefined);
    });
  }

  function choose(node: SVGGElement) {
    if (locked) return;
    locked = true;
    const choice = node.dataset.choice!;
    const chosenX = Number(node.dataset.x);
    const currentLevel = level;
    const parentDecision = activeDecision;
    const parent = elements.graph.querySelector<SVGGElement>(`.current-node[data-level="${currentLevel}"]`);
    const parentX = Number(parent?.dataset.x ?? 215);
    history.push({ parentDecision, choice, level: currentLevel, parentX, chosenX });
    elements.hint.classList.remove("visible");
    elements.graph.querySelectorAll<SVGGElement>(`.choice-node[data-level="${currentLevel}"]`).forEach((sibling) => {
      sibling.classList.toggle("rejected", sibling !== node);
    });
    node.classList.add("chosen");
    parent?.classList.replace("current-node", "past-node");
    elements.graph.querySelector(`.branch-level[data-branch-level="${currentLevel}"]`)?.classList.add("past-branch");

    const expansion = ensureBranches(choice);
    later(async () => {
      try {
        await expansion;
        node.classList.remove("choice-node", "chosen");
        node.classList.add("current-node");
        node.removeAttribute("data-choice");
        node.removeAttribute("role");
        node.removeAttribute("tabindex");
        node.dataset.level = String(currentLevel + 1);
        node.querySelector(".node-circle")?.setAttribute("r", "62");
        node.querySelector(".node-halo")?.setAttribute("r", "75");
        activeDecision = choice;
        level += 1;
        prefetchNearby(decisions[choice]?.branches);
        const scale = scaleFor(choice);
        const currentY = 660 - level * 430;
        animateCamera(chosenX - 215 * scale, currentY - 660 * scale, scale, 1900);
        later(() => {
          addBranches(choice, level, chosenX);
          elements.undo.classList.add("visible");
          clearDetail();
          locked = false;
        }, 1750);
      } catch {
        locked = false;
        onError("I couldn't open that path yet.");
      }
    }, 850);
  }

  function undoChoice() {
    if (locked || !history.length) return;
    locked = true;
    const state = history.pop()!;
    elements.hint.classList.remove("visible");
    const currentLevel = level;
    elements.graph.querySelector(`.branch-level[data-branch-level="${currentLevel}"]`)?.remove();
    elements.graph.querySelectorAll(`.choice-node[data-level="${currentLevel}"]`).forEach((node) => node.remove());
    const selected = elements.graph.querySelector<SVGGElement>(`.current-node[data-level="${currentLevel}"][data-node-id="${state.choice}"]`);
    if (selected) {
      selected.classList.remove("current-node");
      selected.classList.add("choice-node");
      selected.dataset.level = String(state.level);
      selected.dataset.choice = state.choice;
      selected.setAttribute("role", "button");
      selected.setAttribute("tabindex", "0");
      selected.querySelector(".node-circle")?.setAttribute("r", "55");
      selected.querySelector(".node-halo")?.setAttribute("r", "66");
    }
    elements.graph.querySelectorAll(`.choice-node[data-level="${state.level}"]`).forEach((node) => node.classList.remove("rejected", "chosen"));
    elements.graph.querySelector(`.branch-level[data-branch-level="${state.level}"]`)?.classList.remove("past-branch");
    elements.graph.querySelector(`.past-node[data-level="${state.level}"]`)?.classList.replace("past-node", "current-node");
    activeDecision = state.parentDecision;
    level = state.level;
    const scale = scaleFor(activeDecision);
    const currentY = 660 - level * 430;
    animateCamera(state.parentX - 215 * scale, currentY - 660 * scale, scale, 1900);
    later(() => {
      elements.undo.classList.toggle("visible", history.length > 0);
      clearDetail();
      locked = false;
    }, 1850);
  }

  function showDetail(node: SVGGElement | null) {
    if (!node?.dataset.detail) return;
    elements.hint.textContent = node.dataset.detail;
    elements.hint.className = "branch-caption detail visible";
  }

  function clearDetail() {
    elements.hint.textContent = "Hover to understand · touch to follow";
    elements.hint.className = "branch-caption visible";
  }

  function handleTreeClick(target: EventTarget | null) {
    const node = (target as Element | null)?.closest?.<SVGGElement>(".choice-node[data-choice]");
    if (node) choose(node);
  }

  function handleTreeKeyDown(event: KeyboardEvent) {
    const node = (event.target as Element | null)?.closest?.<SVGGElement>(".choice-node[data-choice]");
    if (node && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      choose(node);
    }
  }

  function handlePointerOver(target: EventTarget | null) {
    showDetail((target as Element | null)?.closest?.<SVGGElement>(".svg-node[data-detail]") ?? null);
  }

  function handlePointerOut(target: EventTarget | null) {
    if ((target as Element | null)?.closest?.(".svg-node[data-detail]")) clearDetail();
  }

  function destroy() {
    runToken += 1;
    clearTimers();
  }

  reset();
  return {
    reset,
    start,
    undoChoice,
    handleTreeClick,
    handleTreeKeyDown,
    handlePointerOver,
    handlePointerOut,
    clearDetail,
    destroy,
  };
}

function toBranch(node: DecisionNode): Branch {
  return { id: node.id, label: node.label, detail: node.summary };
}

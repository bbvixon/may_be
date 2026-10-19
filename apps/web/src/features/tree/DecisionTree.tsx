import type { DecisionGraph } from "@maybe/contracts";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";

type Props = {
  graph: DecisionGraph;
  onChoose?: (nodeId: string) => void;
};

export function DecisionTree({ graph, onChoose }: Props) {
  const [focused, setFocused] = useState<string | null>(null);
  const root = graph.nodes.find((node) => node.id === graph.rootNodeId)!;
  const children = useMemo(
    () => graph.edges
      .filter((edge) => edge.from === root.id)
      .map((edge) => graph.nodes.find((node) => node.id === edge.to))
      .filter((node): node is NonNullable<typeof node> => Boolean(node)),
    [graph, root.id],
  );
  const width = 430;
  const rootX = width / 2;
  const gap = width / (children.length + 1);

  return (
    <div className="tree" aria-label={graph.title}>
      <svg viewBox="0 0 430 620" role="group">
        <g className="branches">
          {children.map((child, index) => {
            const x = gap * (index + 1);
            return (
              <motion.path
                key={`edge-${child.id}`}
                d={`M ${rootX} 380 C ${rootX} 280, ${x} 250, ${x} 160`}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 1.6, delay: index * 0.16, ease: [0.2, 0.8, 0.2, 1] }}
              />
            );
          })}
        </g>
        {children.map((child, index) => {
          const x = gap * (index + 1);
          return (
            <g
              key={child.id}
              className="choice"
              role="button"
              tabIndex={0}
              aria-label={`${child.label}. ${child.summary}`}
              transform={`translate(${x} 130)`}
              onMouseEnter={() => setFocused(child.id)}
              onMouseLeave={() => setFocused(null)}
              onFocus={() => setFocused(child.id)}
              onBlur={() => setFocused(null)}
              onClick={() => onChoose?.(child.id)}
            >
              <motion.g
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.9, delay: 0.8 + index * 0.16 }}
              >
                <circle r="48" />
                <text textAnchor="middle" dominantBaseline="middle">{child.label}</text>
              </motion.g>
            </g>
          );
        })}
        <g className="root" transform={`translate(${rootX} 430)`}>
          <circle r="62" />
          <text textAnchor="middle" dominantBaseline="middle">{root.label}</text>
        </g>
      </svg>
      <AnimatePresence mode="wait">
        <motion.p
          key={focused ?? "hint"}
          className="detail"
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
        >
          {focused
            ? graph.nodes.find((node) => node.id === focused)?.summary
            : "Touch a path to follow it."}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

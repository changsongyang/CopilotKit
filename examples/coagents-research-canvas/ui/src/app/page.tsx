"use client";

import { CopilotKit } from "@copilotkit/react-core";
import Main from "./Main";
import {
  ModelSelectorProvider,
  useModelSelectorContext,
} from "@/lib/model-selector-provider";
import { ModelSelector } from "@/components/ModelSelector";
import { useRouter, useSearchParams } from "next/navigation";
import { router } from "next/client";

export default function ModelSelectorWrapper() {
  return (
    <ModelSelectorProvider>
      <Home />
      <ModelSelector />
    </ModelSelectorProvider>
  );
}

function Home() {
  const { agent, useLgc } = useModelSelectorContext();

  return (
    <CopilotKit
      runtimeUrl={useLgc ? "/api/copilotkit-lgc" : "/api/copilotkit"}
      showDevConsole={false}
      agent={agent}
    >
      <Main />
    </CopilotKit>
  );
}

import { useState, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PipelineStep = "idle" | "indexing" | "searching" | "analyzing" | "done" | "error";

export interface IndexStatus {
  project_id: string;
  github_url: string | null;
  total_files: number;
  indexed_files: number;
  status: string;
  last_indexed_at: string | null;
  error_message: string | null;
}

export function useCodebaseIndexer(projectId: string, githubUrl?: string, githubPat?: string) {
  const [currentStep, setCurrentStep] = useState<PipelineStep>("idle");
  const [stepMessage, setStepMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: indexStatus, refetch: refetchStatus } = useQuery({
    queryKey: ["repo-index-status", projectId],
    enabled: projectId !== "all",
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("repo_index_status")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle();
      if (error) throw error;
      return data as IndexStatus | null;
    },
  });

  const { data: codeLocations } = useQuery({
    queryKey: ["event-code-locations", projectId],
    enabled: projectId !== "all",
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("event_code_locations")
        .select("*")
        .eq("project_id", projectId);
      if (error) throw error;
      return data as Array<{
        id: string;
        event_name: string;
        file_path: string;
        line_number: number;
        code_snippet: string;
        surrounding_context: string;
        semantic_meaning: string | null;
      }>;
    },
  });

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const pollStatus = useCallback(() => {
    stopPolling();
    pollingRef.current = setInterval(async () => {
      const { data } = await (supabase.from as any)("repo_index_status")
        .select("*")
        .eq("project_id", projectId)
        .maybeSingle();
      if (data && (data.status === "completed" || data.status === "failed")) {
        stopPolling();
        refetchStatus();
      } else {
        refetchStatus();
      }
    }, 3000);
  }, [projectId, refetchStatus, stopPolling]);

  const runStep = useCallback(async (step: "index" | "search" | "analyze") => {
    setError(null);
    try {
      if (step === "index") {
        setCurrentStep("indexing");
        setStepMessage("Fetching repository files...");
        pollStatus();
        const resp = await supabase.functions.invoke("index-github-repo", { body: { project_id: projectId, github_url: githubUrl, github_pat: githubPat } });
        stopPolling();
        if (resp.error) throw new Error(resp.error.message || "Indexing failed");
        await refetchStatus();
        setStepMessage(`Indexed ${resp.data.indexed_files} files`);
      } else if (step === "search") {
        setCurrentStep("searching");
        setStepMessage("Searching for events in codebase...");
        const resp = await supabase.functions.invoke("search-events-in-codebase", { body: { project_id: projectId } });
        if (resp.error) throw new Error(resp.error.message || "Search failed");
        setStepMessage(`Found ${resp.data.events_found} events in ${resp.data.total_locations} locations`);
        queryClient.invalidateQueries({ queryKey: ["event-code-locations", projectId] });
      } else if (step === "analyze") {
        setCurrentStep("analyzing");
        setStepMessage("Running semantic analysis...");
        const resp = await supabase.functions.invoke("analyze-event-semantics", { body: { project_id: projectId } });
        if (resp.error) throw new Error(resp.error.message || "Analysis failed");
        setStepMessage(`Analyzed ${resp.data.analyzed} events`);
        queryClient.invalidateQueries({ queryKey: ["event-code-locations", projectId] });
        queryClient.invalidateQueries({ queryKey: ["event-annotations", projectId] });
      }
    } catch (e: any) {
      setError(e.message);
      setCurrentStep("error");
      stopPolling();
      throw e;
    }
  }, [projectId, githubUrl, githubPat, pollStatus, stopPolling, refetchStatus, queryClient]);

  const runPipeline = useCallback(async () => {
    try {
      await runStep("index");
      await runStep("search");
      await runStep("analyze");
      setCurrentStep("done");
    } catch {
      // error already set in runStep
    }
  }, [runStep]);

  const isRunning = currentStep === "indexing" || currentStep === "searching" || currentStep === "analyzing";

  return {
    currentStep,
    stepMessage,
    error,
    isRunning,
    indexStatus,
    codeLocations: codeLocations || [],
    runPipeline,
    runStep,
    refetchStatus,
  };
}

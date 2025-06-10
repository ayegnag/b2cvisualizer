import { useState, useMemo } from "react";
import { ReactFlow, Controls, Background, MarkerType } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import UploadStep from "./components/UploadStep.jsx";
import CustomStepNode from "./components/CustomStepNode.jsx";
import { parseXmlFile, findElementByTag, findElementsByTag, extractClaims } from "./utils/xmlParser.js";
import colorTools from "./utils/getColors.js";

function App() {
  const [relyingPartyXml, setRelyingPartyXml] = useState(null);
  const [extensionXml, setExtensionXml] = useState(null);
  const [baseXml, setBaseXml] = useState(null);
  const [viewMode, setViewMode] = useState("details");
  const [selectedStep, setSelectedStep] = useState(null);

  const nodeTypes = {
    stepNode: CustomStepNode,
  };

  const orchestrationSteps = useMemo(() => {
    if (!relyingPartyXml) return null;
    const doc = relyingPartyXml.xml;

    // Use namespace-aware function
    const defaultUserJourneyNode = findElementByTag(doc, "DefaultUserJourney");
    if (!defaultUserJourneyNode) return null;

    const journeyRefId = defaultUserJourneyNode.getAttribute("ReferenceId");
    if (!journeyRefId) return null;

    // Search for UserJourney across all policy files (RelyingParty, Extension, Base)
    const searchXmls = [relyingPartyXml.xml, extensionXml?.xml, baseXml?.xml].filter(Boolean);
    let userJourney = null;

    for (const xml of searchXmls) {
      const userJourneys = findElementsByTag(xml, "UserJourney");
      userJourney = userJourneys.find((uj) => uj.getAttribute("Id") === journeyRefId);
      if (userJourney) break;
    }

    if (!userJourney) return null;

    const getTechProfileById = (id) => {
      const sources = [
        { xml: relyingPartyXml?.xml, label: "RelyingParty" },
        { xml: extensionXml?.xml, label: "Extension" },
        { xml: baseXml?.xml, label: "Base" },
      ].filter((s) => s.xml);

      for (const { xml, label } of sources) {
        const profiles = xml.getElementsByTagName("TechnicalProfile");
        for (let tp of profiles) {
          if (tp.getAttribute("Id") === id) {
            return { def: tp, sourceFile: label };
          }
        }
      }
      return null;
    };

    // Use namespace-aware function for OrchestrationStep
    const orchestrationStepNodes = findElementsByTag(userJourney, "OrchestrationStep");
    const steps = orchestrationStepNodes.map((step) => {
      const order = step.getAttribute("Order");
      const typeElement = findElementByTag(step, "Type");
      // const stepType = typeElement?.textContent || "Unknown";

      // Use namespace-aware functions for ClaimsExchange and TechnicalProfile
      const claimsExchangeNodes = findElementsByTag(step, "ClaimsExchange");
      const techProfileNodes = findElementsByTag(step, "TechnicalProfile");
      const journeyRef = findElementByTag(step, "JourneyReference");
      const isRecursive = journeyRef ? true : false;
      const referencedJourneyId = journeyRef?.getAttribute("Id");

      const preconditionNode = findElementByTag(step, "Preconditions");
      const predicateNodes = findElementsByTag(step, "PredicateReference");
      const hasConditions = preconditionNode || predicateNodes.length > 0;
      const conditions = predicateNodes.map((p) => p.getAttribute("ReferenceId"));

      let stepType = typeElement?.textContent;
      if (!stepType) {
        stepType = claimsExchangeNodes.length > 0 ? "ClaimsExchange" : techProfileNodes.length > 0 ? "UserInterface" : "Unknown";
      }

      const profileNodes = claimsExchangeNodes.length > 0 ? claimsExchangeNodes : techProfileNodes;

      const profileIds = Array.from(profileNodes)
        .map((p) => p.getAttribute("TechnicalProfileReferenceId") || p.getAttribute("Id"))
        .filter(Boolean);

      // Build contentDefinitionMap
      const contentDefinitionMap = {};
      for (const { xml } of [{ xml: relyingPartyXml?.xml }, { xml: extensionXml?.xml }, { xml: baseXml?.xml }]) {
        if (!xml) continue;
        const defs = findElementsByTag(xml, "ContentDefinition");
        for (const def of defs) {
          const id = def.getAttribute("Id");
          const loadUri = findElementByTag(def, "LoadUri")?.textContent;
          const dataUri = findElementByTag(def, "DataUri")?.textContent;
          if (id) {
            contentDefinitionMap[id] = { loadUri, dataUri };
          }
        }
      }

      const resolvedProfiles = profileIds.map((id) => {
        const result = getTechProfileById(id);
        if (!result) return { id, notFound: true };

        const { def, sourceFile } = result;

        const protocolElement = findElementByTag(def, "Protocol");
        const protocol = protocolElement?.getAttribute("Name") || "Unknown";

        const displayNameElement = findElementByTag(def, "DisplayName");
        const displayName = displayNameElement?.textContent || "";

        const inputClaimNodes = findElementsByTag(def, "InputClaim");
        const outputClaimNodes = findElementsByTag(def, "OutputClaim");
        const inputClaims = extractClaims(inputClaimNodes);
        const outputClaims = extractClaims(outputClaimNodes);

        const isSelfAsserted = def.getAttribute("Id")?.includes("SelfAsserted");
        const metadataNodes = findElementsByTag(def, "Metadata");
        const isRest = protocol === "Proprietary" && metadataNodes?.length > 0;
        let contentDef = null;
        const metadataItems = findElementsByTag(def, "Item");
        for (const item of metadataItems) {
          if (item.getAttribute("Key") === "ContentDefinitionReferenceId") {
            contentDef = item.textContent;
            break;
          }
        }

        const localizedRef = findElementsByTag(def, "LocalizedResourcesReference").map((l) => l.getAttribute("ReferenceId"));

        const contentInfo = contentDef && contentDefinitionMap[contentDef] ? contentDefinitionMap[contentDef] : null;

        return {
          id,
          protocol,
          displayName,
          inputClaims,
          outputClaims,
          isSelfAsserted,
          sourceFile,
          isRest,
          hasConditions,
          conditions,
          contentDef,
          localizedRef,
          contentInfo,
        };
      });

      return { order, stepType, profileIds, resolvedProfiles, isRecursive, referencedJourneyId };
    });

    // Extract BasePolicy information for reference
    const basePolicyNode = findElementByTag(doc, "BasePolicy");
    const basePolicyInfo = basePolicyNode
      ? {
          tenantId: findElementByTag(basePolicyNode, "TenantId")?.textContent,
          policyId: findElementByTag(basePolicyNode, "PolicyId")?.textContent,
        }
      : null;

    return { journeyRefId, steps, basePolicyInfo };
  }, [relyingPartyXml, extensionXml, baseXml]);

  // Create React Flow nodes and edges from orchestration steps
  const { nodes, edges } = useMemo(() => {
    if (!orchestrationSteps?.steps) return { nodes: [], edges: [] };

    const stepNodes = orchestrationSteps.steps.map((step, index) => ({
      id: `step-${step.order}`,
      type: "stepNode",
      position: { x: 0, y: index * 300 },
      data: {
        order: step.order,
        stepType: step.stepType,
        profiles: step.resolvedProfiles,
      },
    }));

    const stepEdges = orchestrationSteps.steps.slice(0, -1).map((step, index) => ({
      id: `edge-${step.order}-${orchestrationSteps.steps[index + 1].order}`,
      source: `step-${step.order}`,
      target: `step-${orchestrationSteps.steps[index + 1].order}`,
      type: "smoothstep",
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 20,
        height: 20,
        color: "#6366f1",
      },
      style: {
        strokeWidth: 2,
        stroke: "#6366f1",
      },
    }));

    return { nodes: stepNodes, edges: stepEdges };
  }, [orchestrationSteps]);
  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r p-4 overflow-y-auto">
        <h2 className="text-xl font-semibold mb-4">Uploaded Files</h2>
        <ul className="space-y-2 text-sm">
          {[
            { label: "RelyingParty", data: relyingPartyXml },
            { label: "Extension", data: extensionXml },
            { label: "Base", data: baseXml },
          ].map(({ label, data }) => (
            <li key={label}>
              <strong>{label}:</strong>{" "}
              {data ? <span className="text-green-700">{data.name}</span> : <span className="text-gray-400 italic">Pending</span>}
            </li>
          ))}
        </ul>
      </aside>

      {/* Main */}
      <main className="flex-1 p-6 overflow-y-auto">
        <h1 className="text-2xl font-bold mb-6">Upload Azure AD B2C Policies</h1>

        <UploadStep label="1. Upload RelyingParty Policy" onUpload={(f) => parseXmlFile(f, setRelyingPartyXml)} done={relyingPartyXml} />
        {relyingPartyXml && (
          <UploadStep label="2. Upload Extension Policy" onUpload={(f) => parseXmlFile(f, setExtensionXml)} done={extensionXml} />
        )}
        {extensionXml && <UploadStep label="3. Upload Base Policy" onUpload={(f) => parseXmlFile(f, setBaseXml)} done={baseXml} />}

        {/* User Journey */}
        {orchestrationSteps && (
          <div className="mt-8">
            <div className="mb-4 p-4 border rounded bg-white shadow">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-indigo-700 mb-2">Default User Journey: {orchestrationSteps.journeyRefId}</h2>
                  {orchestrationSteps.basePolicyInfo && (
                    <div className="text-sm text-gray-600 bg-blue-50 p-2 rounded">
                      <strong>Base Policy:</strong> {orchestrationSteps.basePolicyInfo.policyId}
                      {orchestrationSteps.basePolicyInfo.tenantId && (
                        <span className="ml-2">({orchestrationSteps.basePolicyInfo.tenantId})</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setViewMode("details")}
                    className={`px-4 py-2 rounded text-sm font-medium ${
                      viewMode === "details" ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    Details View
                  </button>
                  <button
                    onClick={() => setViewMode("graph")}
                    className={`px-4 py-2 rounded text-sm font-medium ${
                      viewMode === "graph" ? "bg-indigo-600 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    Graph View
                  </button>
                </div>
              </div>
            </div>

            {viewMode === "graph" ? (
              <div className="bg-white border rounded shadow" style={{ height: "600px" }}>
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  nodeTypes={nodeTypes}
                  fitView
                  fitViewOptions={{ padding: 0.2 }}
                  onNodeClick={(_, node) => {
                    const step = orchestrationSteps.steps.find((s) => `step-${s.order}` === node.id);
                    setSelectedStep(step);
                  }}
                >
                  <Controls />
                  <Background variant="dots" gap={12} size={1} />
                </ReactFlow>

                {/* Details Pane */}
                {selectedStep && (
                  <div className="fixed top-0 right-0 w-96 h-full bg-white shadow-lg p-4 overflow-y-auto z-50">
                    <div className="flex justify-between items-center mb-4">
                      <h2 className="text-xl font-bold text-indigo-600">Step {selectedStep.order}</h2>
                      <button onClick={() => setSelectedStep(null)} className="text-sm text-gray-600 hover:underline">
                        Close
                      </button>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <strong>Step Type:</strong> {selectedStep.stepType}
                      </div>
                      {selectedStep.resolvedProfiles.map((tp) =>
                        tp.notFound ? (
                          <div key={tp.id} className="text-red-600">
                            ❌ {tp.id} not found
                          </div>
                        ) : (
                          <div key={tp.id} className="border p-2 rounded bg-gray-50">
                            <div className="font-semibold">{tp.id}</div>
                            {tp.displayName && <div className="text-sm italic">{tp.displayName}</div>}
                            <div className="text-sm">
                              <strong>Protocol:</strong> {tp.protocol}
                            </div>
                            <div className="text-sm">
                              <strong>Input Claims:</strong> {tp.inputClaims.join(", ")}
                            </div>
                            <div className="text-sm">
                              <strong>Output Claims:</strong> {tp.outputClaims.join(", ")}
                            </div>
                            <div className="text-sm">
                              <strong>Source File:</strong> {tp.sourceFile}
                            </div>
                            {selectedStep.isRecursive && (
                              <span className="text-xs bg-pink-200 text-pink-800 px-2 py-0.5 rounded">
                                Recursive: {selectedStep.referencedJourneyId}
                              </span>
                            )}
                            {selectedStep.hasConditions && (
                              <div className="text-sm">
                                <strong>Conditions:</strong> {selectedStep.conditions.join(", ")}
                              </div>
                            )}
                            {tp.contentDef && (
                              <div className="text-sm">
                                <strong>Template:</strong> {tp.contentDef}
                              </div>
                            )}
                            {tp.localizedRef?.length > 0 && (
                              <div className="text-sm">
                                <strong>Localized Resources:</strong> {tp.localizedRef.join(", ")}
                              </div>
                            )}
                            {tp.contentInfo?.loadUri && (
                              <div className="text-sm wrap-break-word">
                                <strong>LoadUri:</strong> {tp.contentInfo.loadUri}
                              </div>
                            )}
                            {tp.contentInfo?.dataUri && (
                              <div className="text-sm wrap-break-word">
                                <strong>DataUri:</strong> {tp.contentInfo.dataUri}
                              </div>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 border rounded bg-white shadow">
                {orchestrationSteps.steps.map((step) => (
                  <div key={step.order} className="mb-6">
                    <h3 className="text-lg font-semibold mb-1">
                      Step {step.order}: {step.stepType} {step.hasConditions && <div>⚠️ Conditioned</div>}
                    </h3>
                    <div className="space-y-2 ml-4">
                      {step.resolvedProfiles.map((tp) =>
                        tp.notFound ? (
                          <div key={tp.id} className="text-red-600">
                            ❌ Profile not found: {tp.id}
                          </div>
                        ) : (
                          <div key={tp.id} className="p-2 bg-gray-50 border rounded">
                            <div className="font-medium text-indigo-600">{tp.id}</div>
                            {tp.displayName && <div className="text-sm text-gray-600 italic">{tp.displayName}</div>}
                            <div className="text-sm mt-1">
                              <span className="font-semibold">Protocol:</span>
                              <span className={`ml-2 text-xs px-2 py-1 rounded ${colorTools.getProtocolBadgeColor(tp.protocol)}`}>
                                {tp.protocol}
                              </span>
                              {tp.isSelfAsserted && (
                                <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">SelfAsserted</span>
                              )}
                              {tp.isRest && <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">REST API</span>}
                              {step.isRecursive && (
                                <span className="text-xs bg-pink-200 text-pink-800 px-2 py-0.5 rounded">
                                  Recursive: {step.referencedJourneyId}
                                </span>
                              )}
                            </div>
                            <div className="text-sm mt-1">
                              <span className="font-semibold">InputClaims:</span>{" "}
                              {tp.inputClaims.length > 0 ? tp.inputClaims.join(", ") : <span className="italic text-gray-400">None</span>}
                            </div>
                            <div className="text-sm">
                              <span className="font-semibold">OutputClaims:</span>{" "}
                              {tp.outputClaims.length > 0 ? tp.outputClaims.join(", ") : <span className="italic text-gray-400">None</span>}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;

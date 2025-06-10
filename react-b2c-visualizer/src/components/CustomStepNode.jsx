import colorTools from "../utils/getColors.js";

export default function CustomStepNode({ data }) {
  return (
    <div className={`p-4 rounded-lg border-2 min-w-80 ${colorTools.getStepColor(data.stepType)} shadow-md`}>
      <div className="font-bold text-lg mb-2">
        Step {data.order}: {data.stepType}
      </div>

      {data.profiles.map((profile, idx) => (
        <div key={idx} className="mb-3 last:mb-0">
          {profile.notFound ? (
            <div className="text-red-600 text-sm">❌ Profile not found: {profile.id}</div>
          ) : (
            <div className="bg-white p-3 rounded border">
              <div className="font-semibold text-indigo-700 mb-1">{profile.id}</div>
              {profile.displayName && <div className="text-sm text-gray-600 italic mb-2">{profile.displayName}</div>}

              <div className="flex flex-wrap gap-1 mb-2">
                <span className={`text-xs px-2 py-1 rounded ${colorTools.getProtocolBadgeColor(profile.protocol)}`}>{profile.protocol}</span>
                {profile.isSelfAsserted && <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-1 rounded">SelfAsserted</span>}
                {profile.isRest && <span className="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded">REST API</span>}
              </div>

              <div className="text-xs space-y-1">
                <div>
                  <span className="font-medium">In:</span>{" "}
                  {profile.inputClaims.length > 0
                    ? profile.inputClaims.slice(0, 3).join(", ") + (profile.inputClaims.length > 3 ? "..." : "")
                    : "None"}
                </div>
                <div>
                  <span className="font-medium">Out:</span>{" "}
                  {profile.outputClaims.length > 0
                    ? profile.outputClaims.slice(0, 3).join(", ") + (profile.outputClaims.length > 3 ? "..." : "")
                    : "None"}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

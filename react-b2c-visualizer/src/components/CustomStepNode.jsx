export default function CustomStepNode({ data }) {
  const getStepColor = (stepType) => {
    switch (stepType.toLowerCase()) {
      case "claimsexchange":
        return "bg-blue-100 border-blue-300";
      case "combinedcheckout":
        return "bg-green-100 border-green-300";
      case "claimsproviderselection":
        return "bg-purple-100 border-purple-300";
      case "userinterface":
        return "bg-yellow-100 border-yellow-300";
      default:
        return "bg-gray-100 border-gray-300";
    }
  };

  const getProtocolBadgeColor = (protocol) => {
    switch (protocol) {
      case "OpenIdConnect":
        return "bg-blue-500 text-white";
      case "SAML2":
        return "bg-green-500 text-white";
      case "Proprietary":
        return "bg-purple-500 text-white";
      case "OAuth2":
        return "bg-red-500 text-white";
      default:
        return "bg-gray-500 text-white";
    }
  };

  return (
    <div className={`p-4 rounded-lg border-2 min-w-80 ${getStepColor(data.stepType)} shadow-md`}>
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
                <span className={`text-xs px-2 py-1 rounded ${getProtocolBadgeColor(profile.protocol)}`}>{profile.protocol}</span>
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

const colorTools = {
  getProtocolBadgeColor (protocol) {
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
  },
  getStepColor(stepType) {
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
  }
}

export default colorTools;
export function parseXmlFile(file, setter) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parser = new DOMParser();
        const xml = parser.parseFromString(reader.result, "text/xml");
        if (xml.querySelector("parsererror")) {
          alert("Invalid XML file");
          return;
        }
        setter({ name: file.name, xml });
      } catch {
        alert("Failed to parse XML.");
      }
    };
    reader.readAsText(file);
  }
  
  export function findElementByTag(xml, tag) {
    const elements = xml.getElementsByTagNameNS("*", tag)
    return elements.length > 0 ? elements[0] : null
  }
  
  export function findElementsByTag(xml, tag) {
    return Array.from(xml.getElementsByTagNameNS("*", tag))
  }
  
  export function extractClaims(claimNodes) {
    return Array.from(claimNodes).map((claim) => {
      const claimType = claim.getAttribute("ClaimTypeReferenceId") || claim.getAttribute("ClaimType");
      const required = claim.getAttribute("Required") === "true" ? " (required)" : "";
      return claimType + required;
    });
  }
  
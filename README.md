# b2cvisualizer

A simple React based graphical visualizer for Azure B2C Custom Policies



The structure forms a hierarchy:

B2C_1A_TrustFrameworkBase      <-- Base Microsoft-supplied policy
        ↑
B2C_1A_TrustFrameworkExtensions  <-- Your extension layer
        ↑
B2C_1A_SignUpOrSignIn / PasswordReset / ProfileEdit  <-- Your RPs

# proforma_app
A Proforma app with many features

## Codespaces Quick Start

1. Open the repository on GitHub and select **Code** → **Codespaces** → **Create codespace on `work`** (do not use `main`).
2. In your Codespace settings, add a secret named **PROFORMA_PAT** with a fine-grained Personal Access Token that grants **Repository → Contents: Read & write** access to this repo.
3. In the Codespace terminal run:
   ```sh
   npm start
   ```
   The server runs on port 3000 and Codespaces forwards it automatically.
4. Use `/proforma_cwi.html` to create and save proformas and `/history.html` to list and restore them.

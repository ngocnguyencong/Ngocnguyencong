import type { Guide, Section } from "./content";

const preparationLinks = [
  { href: "/docs/web/before-you-start", label: "Install the tools and get the code" },
  { href: "/docs/web/terminal-basics", label: "Learn how to run a command and edit a file" },
] as const;

export const beginnerGuides: readonly Guide[] = [
  {
    slug: "web/before-you-start",
    tab: "web",
    group: "Getting started",
    title: "Before you start",
    description:
      "Install Node.js, Git and an editor, accept your repository invitation, download the kit and check your computer is ready for the first run.",
    continueTo: "web/terminal-basics",
    sections: [
      {
        id: "choose",
        title: "1. Choose what you want to run",
        paragraphs: [
          "Use a Windows, macOS or Linux computer with an internet connection. A browser runs the Web app; a phone runs the Mobile app; the Desktop app opens in its own window. Your phone alone cannot perform the installation steps below.",
          "A repository is the folder of files you received through GitHub. Web, Mobile and Desktop purchases each provide the corresponding kit repository; the All Platforms bundle provides the monorepo, a folder containing all three apps. Accept the invitation for the repository you purchased. A Mobile or Desktop checkout still needs a reachable Web backend: the server that handles accounts and data. Those client repositories do not include the Web server.",
          "Prepare these tools once. Downloading tools and the first native compilation can take much longer than five minutes. The five-minute guides begin after these preparations; running locally does not publish your app to the internet.",
        ],
      },
      {
        id: "node",
        title: "2. Install Node.js",
        paragraphs: [
          "Open the official Node.js download page below. Choose an LTS version numbered 22 or higher and the installer for your computer: .msi on Windows or .pkg on macOS. Open the downloaded installer, keep its defaults and finish installation. Node.js lets your computer run the app's JavaScript; npm is installed with it.",
          "Close and reopen your terminal after installing. On Windows open Start, type PowerShell and open it. On macOS press Command + Space, type Terminal and press Enter. On Linux open Terminal from your applications menu. Paste the command below, then press Enter. A result such as v22.x.x or v24.x.x confirms Node is available. If you see command not found or not recognized, reopen the terminal or reinstall Node with its PATH option enabled.",
        ],
        code: "node --version\nnpm --version",
        links: [{ href: "https://nodejs.org/en/download", label: "Official Node.js installers" }],
      },
      {
        id: "git-editor",
        title: "3. Install Git and a text editor",
        paragraphs: [
          "Open the Git download page below, select your operating system and follow its installer. Git downloads your private repository and records file changes. On macOS, running the command below may offer Apple's command-line tools installation; accept it and rerun the command after it finishes. On Linux use the installation command shown for your distribution on the Git page.",
          "Install Visual Studio Code from its official download page. This is a text editor for opening the project and saving configuration files. Open it, choose File → Open Folder (File → Open on macOS), and later select the supastack folder you download. You do not need to write code to complete the first local demonstration.",
          "In a newly opened terminal, run the command below. A result beginning git version means Git is ready. If the command is missing, finish the installer and reopen the terminal.",
        ],
        code: "git --version",
        links: [
          { href: "https://git-scm.com/downloads/", label: "Official Git installers" },
          { href: "https://code.visualstudio.com/download", label: "Visual Studio Code download" },
        ],
      },
      {
        id: "access",
        title: "4. Accept your GitHub invitation",
        paragraphs: [
          "Sign in to GitHub in your browser using the account you supplied when purchasing. Open your GitHub invitation email, select View invitation and accept access. Then open the invited repository. You should see its files and a green Code button. A 404 usually means the invitation has not been accepted or you are signed in to a different GitHub account.",
          "Select Code → Local → HTTPS and copy the address shown. Use that exact address in the next step. Example addresses containing angle brackets are templates: replace them rather than pasting the brackets. You do not need to guess an organization name or make the private repository public.",
        ],
      },
      {
        id: "clone",
        title: "5. Download the project to your computer",
        paragraphs: [
          "Choose a folder for your projects, such as Documents. Open that folder in File Explorer or Finder. On Windows right-click an empty area and choose Open in Terminal, then choose PowerShell if needed. On macOS open Terminal, type cd followed by a space, drag the folder into the terminal and press Enter. The terminal is now working in that folder.",
          "In the first command below, replace YOUR_COPIED_HTTPS_ADDRESS with the HTTPS address you just copied. Run one line at a time. The first line creates a new folder named supastack; the second line enters it. If Git asks you to sign in, complete the browser sign-in. Do not use your GitHub account password as a Git password. If browser sign-in is unavailable, follow GitHub's HTTPS authentication guide linked below.",
          "Success: the supastack folder contains package.json, pnpm-workspace.yaml, apps and packages. This is the repository root. If Git says the destination already exists, use a different empty folder or open the existing clone; do not delete your work. Keep this terminal open for the next step.",
        ],
        code: "git clone YOUR_COPIED_HTTPS_ADDRESS supastack\ncd supastack",
        links: [
          {
            href: "https://docs.github.com/en/get-started/git-basics/about-remote-repositories",
            label: "GitHub HTTPS authentication help",
          },
        ],
      },
      {
        id: "corepack",
        title: "6. Check Corepack and the pinned package manager",
        paragraphs: [
          "Run the first command below. Corepack selects the pnpm version recorded in package.json; pnpm downloads the libraries the project uses. If Corepack asks permission to download that version, type y and press Enter. This checkout pins pnpm 11.19.0; keep its pin rather than choosing a different package manager.",
          "If corepack is missing, run npm install --global corepack, reopen your terminal and retry. If PowerShell says an npm.ps1 or corepack.ps1 script cannot run, use npm.cmd or corepack.cmd for that command, including corepack.cmd pnpm install. You do not need to change your computer's execution policy.",
          "The filtered first-run commands call Corepack directly. If you use a Turbo command such as corepack pnpm dev, Turbo also needs a pnpm command on PATH. Windows setup below creates that command in a user-writable folder; its PATH change lasts for the current terminal only. Run this block again after opening a new terminal if pnpm is missing. On macOS/Linux, run corepack enable; if it reports a permission error, use the filtered first-run command instead.",
        ],
        code: "corepack --version\ncorepack pnpm --version\n\n# Windows PowerShell only, for Turbo commands:\n$kitShimDir = Join-Path $env:LOCALAPPDATA 'supastack/corepack-shims'\nNew-Item -ItemType Directory -Path $kitShimDir -Force | Out-Null\ncorepack enable --install-directory $kitShimDir\n$env:PATH = \"$kitShimDir;$env:PATH\"",
        links: preparationLinks.slice(1),
      },
      {
        id: "ready",
        title: "7. Continue with your platform",
        paragraphs: [
          "You are ready when Node and Git print versions, Corepack can select the pinned pnpm, and your terminal is in the folder containing package.json. Pick one tutorial below. Docker is optional for the Web demonstration; a database is required later for real accounts. Desktop also needs Rust and native build tools, which its tutorial explains before its launch command.",
        ],
        links: [
          { href: "/docs/web/local-setup", label: "Run the Web app" },
          { href: "/docs/mobile/local-setup", label: "Run the Mobile app" },
          { href: "/docs/desktop/local-setup", label: "Run the Desktop app" },
        ],
      },
    ],
  },
  {
    slug: "web/terminal-basics",
    tab: "web",
    group: "Getting started",
    title: "Commands, files and configuration",
    description:
      "Learn where to paste commands, how to open the correct project folder, edit .env files, stop a server and report a setup error without sharing secrets.",
    continueTo: "web/local-setup",
    sections: [
      {
        id: "terminal",
        title: "A command goes in the terminal",
        paragraphs: [
          "A terminal is the window where you type instructions for your computer. In Visual Studio Code, first open your supastack folder using File → Open Folder, then select Terminal → New Terminal. The new terminal starts in that folder. On Windows choose PowerShell using the menu next to the terminal's + button. Use macOS/Linux blocks in a macOS or Linux terminal.",
          "Paste only the contents of a command block, one command at a time, and press Enter. Do not paste the surrounding Markdown backticks, a prompt such as PS C:\\..., or example output. Lines starting with # are explanations; they do not run anything. Wait for each installation command to finish before entering the next command. A server command keeps running and does not return a fresh prompt until you stop it.",
        ],
      },
      {
        id: "root",
        title: "Check which folder the terminal is using",
        paragraphs: [
          "Repository root means the top-level supastack folder containing package.json, pnpm-workspace.yaml, apps and packages. Unless a step says otherwise, run commands there. The command below prints the current folder; the file listing should show package.json. In Windows PowerShell pwd and ls also work.",
          "If the listing shows only the contents of apps/web or apps/mobile, type cd ../.. and press Enter to return to the root. If it shows your home folder, type cd followed by a space and the full path to your clone, enclosed in quotation marks when it contains spaces. Opening the project folder in the editor and creating a new terminal is usually easier.",
        ],
        code: "pwd\nls",
      },
      {
        id: "files",
        title: "Configuration goes in a file, not in the terminal",
        paragraphs: [
          "A block like AI_PROVIDER=fake is configuration text. Open the named .env file in the editor, find the line beginning AI_PROVIDER=, replace its value and save with Ctrl + S (Command + S on macOS). Each setting occupies one line in KEY=value form. Do not add Markdown backticks. Avoid duplicate copies of the same key in one file.",
          "Use root .env for database migration commands, apps/web/.env.local for the Next.js Web server, and apps/mobile/.env.local for Expo. Next and Expo run inside their own app folders and do not automatically load root .env. If a database connection changes, update DATABASE_URL in both root .env and apps/web/.env.local so migrations and the server use the same database. Keep the example file unchanged for future reference.",
          "Files whose names start with a dot may be hidden in your file manager; the editor's Explorer shows them. Make sure the filename is exactly .env.local, not .env.local.txt. These local files can contain passwords and are excluded from Git; do not upload them or paste their contents into support messages.",
        ],
        links: [{ href: "/docs/reference/environment", label: "Find the meaning of each setting" }],
      },
      {
        id: "server",
        title: "Keep the server running; use another terminal for commands",
        paragraphs: [
          "The development server serves your app while you work. Leave its terminal open when a tutorial says open localhost:3000. localhost means this computer; :3000 is the port, like a numbered door used by the app. Put the URL into your browser's address bar, not the terminal.",
          "To run another command while the server is active, select Terminal → New Terminal in the editor. The new terminal is a separate window into the same project. To stop the server, select its terminal and press Ctrl + C once. On Windows, if asked Terminate batch job, type Y and press Enter. Wait for the normal prompt before starting it again.",
          "After editing Web environment settings, stop and restart the Web server with the command below. Saving a source file normally refreshes the page automatically, but environment changes need a restart. After editing Expo settings, stop Expo, then run corepack pnpm --filter @supastack/mobile start --clear to restart and clear its cached bundle.",
        ],
        code: "corepack pnpm --filter @supastack/web dev",
      },
      {
        id: "errors",
        title: "Read a failure and ask for useful help",
        paragraphs: [
          "If an installation returns red error text, stop at that step. Read the first error rather than continuing to launch the app. Command not found usually means a missing tool; no package.json usually means the wrong folder; ECONNREFUSED usually means a required server or database is not running; EADDRINUSE means another process already uses the port.",
          "When asking for help, include your operating system, the guide URL and step number, the exact command you entered, and the first error message. Remove passwords, API keys, tokens and the password portion of any database URL. Do not send your .env files. A screenshot of the error can help, but copyable text is easier to diagnose.",
        ],
        links: [
          { href: "/docs/web/troubleshooting", label: "Troubleshoot a specific setup failure" },
        ],
      },
    ],
  },
];

const firstRunGuides: readonly Guide[] = [
  {
    slug: "web/local-setup",
    tab: "web",
    group: "Getting started",
    title: "Set up in 5 minutes",
    description:
      "Run the Web demonstration on your computer with exact Windows and macOS commands, no paid provider credentials, and a clear path to real database-backed accounts.",
    sections: [
      {
        id: "prerequisites",
        title: "1. Prepare your computer and open the project",
        paragraphs: [
          "First complete Before you start: accept the GitHub invitation, install Node.js 22 or newer, Git, an editor and Corepack, then clone your Web repository or the All Platforms monorepo. Open the supastack folder in the editor and select Terminal → New Terminal. You should see package.json in the editor's top-level file list. All commands below run from this repository root.",
          "This starts the local demonstration without accounts at AI, billing or email providers and without Docker. Allow extra time for first-time dependency downloads. Follow only the Windows block or only the macOS/Linux block in the next steps; do not run both.",
        ],
        links: preparationLinks,
      },
      {
        id: "install",
        title: "2. Create configuration files — macOS / Linux",
        paragraphs: [
          "In your terminal, run each line below. The first copy creates .env for later migration commands. The second creates apps/web/.env.local, which the Web server actually reads. Both contain the example's local settings. If either destination file already exists, keep it and skip that copy command; do not overwrite saved settings. Windows users use the next section instead.",
          "corepack pnpm install downloads the libraries the app needs. If Corepack asks to download pnpm, answer y. Wait until it finishes and the terminal prompt returns. A final Done message without an error means you can continue.",
        ],
        code: "cp .env.example .env\ncp .env.example apps/web/.env.local\ncorepack pnpm install",
      },
      {
        id: "windows",
        title: "2. Create configuration files — Windows PowerShell",
        paragraphs: [
          "Use these commands in PowerShell from the folder containing package.json. If .env or apps/web/.env.local already exists, skip its copy line and keep your settings. Wait for installation to finish before starting the server. If script execution is blocked, use corepack.cmd instead of corepack as explained in Before you start.",
        ],
        code: "Copy-Item .env.example .env\nCopy-Item .env.example apps/web/.env.local\ncorepack pnpm install",
      },
      {
        id: "run",
        title: "3. Start the Web server — leave this terminal open",
        paragraphs: [
          "Run the command below from the repository root. It starts only the Web app, so it works in both the Web-only repository and the All Platforms monorepo. Wait for the terminal to show Local: http://localhost:3000 and Ready. The first page may take a little longer to compile. The terminal should keep running; that is expected.",
          "In the All Platforms monorepo, corepack pnpm dev starts the available development workspaces together. If apps/docs is present, that separate docs app uses http://localhost:3001. The public guides you are reading are part of the Web app at http://localhost:3000/docs. You do not need port 3001 to follow this tutorial.",
        ],
        code: "corepack pnpm --filter @supastack/web dev",
      },
      {
        id: "open",
        title: "4. Open the app and complete one local task",
        paragraphs: [
          "In your browser's address bar, open http://localhost:3000 to see the homepage. Then open http://localhost:3000/ai. Keep the prefilled name and email, or enter your own test values, and click Start local reference flow. This creates an in-memory demonstration workspace; it does not create a persistent account or send a real email.",
          "In the demonstration, open AI task from the sidebar, enter a short request such as Summarize the local acceptance criteria, and click Queue local task. When its status is queued, click Run local task, then View result. You should see completed output and an Email queued state. The AI response is deliberately fake and repeatable; the queued email is local. Restarting the server clears this demonstration data.",
          "To use /auth for real sign-up, first start Postgres and apply migrations using the Database and migrations guide. After that, sign-up or OTP messages from EMAIL_PROVIDER=local can be inspected at http://localhost:3000/mail-preview; they do not reach an external inbox. Mobile sign-in also uses this database-backed authentication, rather than the demonstration session.",
        ],
        links: [{ href: "/docs/web/database", label: "Add Postgres and persistent accounts" }],
      },
      {
        id: "verify",
        title: "5. Stop, restart and fix common first-run problems",
        paragraphs: [
          "Success means the homepage loads, the local workspace opens and a queued task reaches completed. When you finish, click the server terminal and press Ctrl + C. To resume later, reopen a terminal in the repository root and repeat the server command from step 3; you do not reinstall dependencies every time.",
          "If localhost:3000 does not open, check that the server terminal is still running and shows Ready. If port 3000 is in use, stop the other development server with Ctrl + C and retry. If you see a database error after opening /auth, return to /ai for the demonstration or complete the database guide. If the local demonstration is missing, check APP_ENV=local, AI_PROVIDER=fake, BILLING_PROVIDER=local, EMAIL_PROVIDER=local and JOB_PROVIDER=local in apps/web/.env.local, then restart.",
          "To customize the name and marketing text, open apps/web/src/marketing/site-config.ts in the editor. Follow Branding for the exact fields and verification steps. For the real account's appearance settings, complete database setup first, then open /settings/appearance. Automated acceptance commands take longer than this first-run walkthrough; find them under Workspace commands.",
        ],
        links: [
          { href: "/docs/web/troubleshooting", label: "Fix a first-run error" },
          { href: "/docs/web/branding", label: "Change your product's name and copy" },
        ],
      },
    ],
  },
  {
    slug: "mobile/local-setup",
    tab: "mobile",
    group: "Getting started",
    title: "Set up Expo in 5 minutes",
    description:
      "Open the Expo app on a phone or simulator, configure an API address the device can reach, and distinguish a UI preview from real sign-in and native purchases.",
    sections: [
      {
        id: "setup",
        title: "1. Prepare the computer, phone and backend",
        paragraphs: [
          "Complete Before you start and open the Mobile repository or All Platforms monorepo in your editor. In Terminal → New Terminal at the repository root, run the install command below. Wait for it to finish. Install Expo Go on your phone using the official Expo page linked below; its version must support the Expo SDK version recorded in apps/mobile/package.json.",
          "A backend is the Web server that handles sign-in, workspace data and AI requests. If your checkout contains apps/web, first run the Web setup in another terminal and leave that server running. Complete its Postgres setup before trying native sign-up or sign-in. A Mobile-only checkout does not contain apps/web: connect it to your running, separately provided backend instead. Starting Expo starts the screen-preview server, not the backend.",
          "Put your phone and computer on the same Wi-Fi. Temporarily disconnect a VPN if it blocks local connections. A phone's localhost means the phone itself. Use your computer's private network address for a physical phone or Android device; iOS Simulator on the same Mac can use http://localhost:3000, and Android Emulator commonly uses http://10.0.2.2:3000.",
        ],
        code: "corepack pnpm install",
        links: [
          ...preparationLinks,
          { href: "/docs/web/local-setup", label: "Start the Web backend" },
          {
            href: "https://expo.dev/go",
            label: "Install an Expo Go version compatible with your project",
          },
        ],
      },
      {
        id: "address",
        title: "2. Find and test the backend address",
        paragraphs: [
          "On Windows run ipconfig in a new PowerShell terminal, find your active Wi-Fi adapter and read IPv4 Address. On macOS open System Settings → Wi-Fi → Details → TCP/IP and read IP address. On Linux open your network settings and read IPv4 Address. An address might look like 192.168.1.25; yours will usually be different.",
          "If your computer's address is 192.168.1.25, open http://192.168.1.25:3000 in the phone's browser while the Web server is running. Substitute your actual address. The homepage must load before you proceed. Allow the Node app on private networks if Windows Firewall asks. If it does not load, check the address, Wi-Fi, firewall and running Web server; an Expo tunnel only carries the preview bundle and does not make your separate API reachable.",
        ],
        code: "# Windows PowerShell only:\nipconfig",
      },
      {
        id: "environment",
        title: "3. Create the Mobile app's configuration file",
        paragraphs: [
          "In the editor's Explorer, expand apps → mobile, create a new file named .env.local, and paste the configuration below into that file. Replace 192.168.1.25 with the address you just tested, or use your provided HTTPS backend address. Save the file. Its full path is apps/mobile/.env.local; root .env is not automatically read by Expo.",
          "Keep the phone's purchase setting off for the first preview. EXPO_PUBLIC_ means a setting is included in the phone app, so these values must contain only public URLs, schemes and public client settings. Do not paste AI-provider, database or billing secrets here. The Web server has its own apps/web/.env.local; changing the Mobile file does not change the server.",
        ],
        code: "EXPO_PUBLIC_API_URL=http://192.168.1.25:3000\nEXPO_PUBLIC_APP_SCHEME=supastack\nEXPO_PUBLIC_MOBILE_PURCHASES_PROVIDER=off",
      },
      {
        id: "workflow",
        title: "4. Start Expo and open the preview",
        paragraphs: [
          "From the repository root, run the command below. Wait for a QR code and the Metro waiting message. Keep this terminal and the backend terminal open. On Android open Expo Go and scan the QR code; on iPhone use Camera, scan the code and open it in Expo Go. The QR code opens the development app, not your backend homepage.",
          "Success means the app's sign-in screen opens on your device. With purchases off, this is a UI preview; complete the database-backed Web authentication setup before testing sign-in, saved workspaces or chat. If an installed simulator is your target, press a in the Expo terminal for Android or i for iOS. iOS Simulator requires macOS and Xcode; it cannot run on Windows.",
        ],
        code: "corepack pnpm --filter @supastack/mobile start",
      },
      {
        id: "verification",
        title: "5. Recover from preview errors and test real flows",
        paragraphs: [
          "If Expo Go reports an incompatible project, compare its supported SDK with apps/mobile/package.json and use the compatible version from the official Expo page. Do not upgrade the kit's dependency versions just to dismiss the message. If a required native module is unavailable, follow Mobile builds for a development build containing that module.",
          "If sign-in fails with a network error, retry the backend URL in the phone's browser first. If the URL works but sign-in fails, inspect the backend terminal and verify Postgres and migrations. The local /ai demo session does not sign you in on the phone. If configuration seems stale, press Ctrl + C in the Expo terminal, then run the restart command below and reopen the preview.",
          "Expo Go cannot prove real StoreKit or Play Billing purchase/restore behavior. Follow In-app purchases and Mobile builds for an EAS development build and store test accounts. First-time native builds and account enrollment can take longer than five minutes. To stop this preview, press Ctrl + C in the Expo terminal; stop the backend separately when finished.",
        ],
        code: "corepack pnpm --filter @supastack/mobile start --clear",
        links: [
          { href: "/docs/mobile/authentication", label: "Set up and test native sign-in" },
          { href: "/docs/mobile/builds", label: "Create a native development build" },
          { href: "/docs/mobile/in-app-purchases", label: "Configure native purchase and restore" },
        ],
      },
    ],
  },
  {
    slug: "desktop/local-setup",
    tab: "desktop",
    group: "Desktop",
    title: "Set up Tauri desktop in 5 minutes",
    description:
      "Prepare Rust and your operating system's build tools, start a reachable Web backend, launch the Tauri window and verify tray, shortcut and local task behavior.",
    sections: [
      {
        id: "prepare",
        title: "1. Install the general and native tools",
        paragraphs: [
          "Complete Before you start, clone your Desktop repository or All Platforms monorepo, and open it in the editor. Desktop is a native window around the same Web app. It does not include a second implementation of accounts or chat. The five-minute launch begins after dependencies and native tools are installed; first-time installation and Rust compilation often take longer.",
          "On Windows install Microsoft C++ Build Tools using the Tauri prerequisites link below. In its installer select Desktop development with C++, keep the Windows SDK selected and complete installation. Ensure Microsoft Edge WebView2 Runtime is installed. Install Rust from rustup.rs using rustup-init.exe; keep the default MSVC toolchain. Reopen your terminal after installation.",
          "On macOS, run xcode-select --install in Terminal and complete the command-line tools dialog if they are not installed. Install Rust using the macOS command from rustup.rs. On Linux, follow the Tauri prerequisite page for your exact distribution's WebKitGTK, compiler, tray and system-library packages, then install Rust. Linux package names vary; do not run another distribution's commands.",
          "Open a terminal at the repository root and run the version checks below. Both rustc and cargo must print versions; cargo is Rust's build tool. If either is missing, finish the installation and reopen the terminal before continuing.",
        ],
        code: "rustc --version\ncargo --version\ncorepack pnpm install",
        links: [
          ...preparationLinks,
          {
            href: "https://tauri.app/start/prerequisites/",
            label: "Tauri's operating-system prerequisite checklist",
          },
          { href: "https://rustup.rs/", label: "Official Rust installer" },
        ],
      },
      {
        id: "backend",
        title: "2. Start or choose the Web backend",
        paragraphs: [
          "If your checkout contains apps/web, follow the Web tutorial, create apps/web/.env.local, run the Web server in a separate terminal using the command below and leave it running. First check http://localhost:3000 in your browser. You can use the /ai demonstration without a database; real sign-in at /auth needs migrated Postgres.",
          "A Desktop-only checkout does not contain apps/web. Use the separately running Web backend supplied for your product, and open its URL in your browser to confirm it works. The desktop shell cannot create the backend for you. Do not try the Web command below if that folder is absent. Step 3 shows how to choose a provided backend address.",
        ],
        code: "# Only when this checkout contains apps/web:\ncorepack pnpm --filter @supastack/web dev",
        links: [
          { href: "/docs/web/local-setup", label: "Run a local Web backend" },
          { href: "/docs/web/database", label: "Prepare real accounts with Postgres" },
        ],
      },
      {
        id: "run",
        title: "3. Launch the desktop window",
        paragraphs: [
          "Open a second terminal at the repository root while the backend stays running. For the default local backend at http://localhost:3000, run the first command below. Cargo may download libraries and compile the shell; wait for the Supastack window to open. Compiler messages during the first build are expected.",
          "For a provided backend, replace https://app.example.com in the appropriate operating-system block below with its actual URL. Run only your platform's block. SUPASTACK_APP_URL is a terminal environment setting, read when the native process starts. Putting it only in root .env will not configure the shell. Keep the backend URL free of embedded usernames or passwords.",
          "In the All Platforms monorepo, corepack pnpm dev:desktop can start Web and Tauri together once pnpm is on PATH as explained in Before you start. The filtered command below also works in Desktop-only checkouts, with the backend running separately.",
        ],
        code: "# Default local backend (all operating systems):\ncorepack pnpm --filter @supastack/desktop dev\n\n# Custom backend — Windows PowerShell only:\n$env:SUPASTACK_APP_URL = 'https://app.example.com'\ncorepack pnpm --filter @supastack/desktop dev\n\n# Custom backend — macOS / Linux only:\nSUPASTACK_APP_URL=https://app.example.com corepack pnpm --filter @supastack/desktop dev",
      },
      {
        id: "verify",
        title: "4. Check the window, tray and shortcut",
        paragraphs: [
          "Success means the window displays the same homepage as your backend in the browser. The desktop window has no browser address bar. To open the credential-free demonstration, quit the shell using the tray's Quit action, then run your operating system's block below in the desktop terminal while the Web server stays running. This loads /ai directly; follow the Web tutorial's local task steps there. Real account sign-in uses the backend's database, just as in the browser.",
          "Close the window using its close button: the app should hide to the tray rather than exit. Click the Supastack tray icon or press Ctrl + Shift + Space on Windows/Linux, or Command + Shift + Space on macOS, to show it again. Use the tray's Quit action to exit. To end development completely, also press Ctrl + C in the desktop terminal and then stop the backend terminal.",
          "If the window is blank or shows a connection problem, first open the configured URL in a browser. Start the backend or correct the URL, then restart Tauri. If Rust reports linker.exe not found, install the Windows C++ workload and reopen the terminal. If Linux reports a missing system library, follow the distribution-specific prerequisites. If the hotkey is already taken, use the tray and follow Native behavior to change it.",
          "This launches a local development window; it does not produce a signed installer or publish an app. Follow Desktop distribution for installer builds, platform signing and testing on another machine. Windows compilation does not verify macOS or Linux behavior.",
        ],
        code: "# Open the local demo — Windows PowerShell only:\n$env:SUPASTACK_APP_URL = 'http://localhost:3000/ai'\ncorepack pnpm --filter @supastack/desktop dev\n\n# Open the local demo — macOS / Linux only:\nSUPASTACK_APP_URL=http://localhost:3000/ai corepack pnpm --filter @supastack/desktop dev",
        links: [
          {
            href: "/docs/desktop/native-behavior",
            label: "Configure native window and shortcut behavior",
          },
          { href: "/docs/desktop/distribution", label: "Build and verify desktop installers" },
        ],
      },
    ],
  },
];

const foundationWalkthroughs: Readonly<Record<string, Section>> = {
  web: {
    id: "first-visit",
    title: "Start here: what you have received",
    paragraphs: [
      "The kit is a starting app you can customize. Web is the browser interface plus the server API; Mobile is the phone interface; Desktop is a native window displaying the Web app. An API is the server address a client calls to sign in or read data. Shared packages are reusable pieces used by these apps.",
      "Start with the Web local tutorial below. It tells you exactly how to download libraries, start the server and run one fake AI task. Then add the database for saved accounts, choose only the providers your product needs, customize your brand and prepare hosting. You can read the technical explanations later; they are not prerequisites for opening the first demo.",
    ],
    links: [
      ...preparationLinks,
      { href: "/docs/web/local-setup", label: "Follow the complete Web first-run tutorial" },
    ],
  },
  "web/configuration": {
    id: "first-change",
    title: "Make one configuration change and check it",
    paragraphs: [
      "Start with a running Web app. In the editor open apps/web/.env.local; if it does not exist, copy .env.example there using the Web tutorial. For a harmless first check, find EMAIL_PROVIDER=local and leave it local. This setting sends product email to the local preview instead of a real inbox. Do not paste KEY=value lines into the terminal.",
      "For each service you enable, follow that provider's setup guide, replace only the named values, save the file, stop the Web server with Ctrl + C and restart with the command below. If validation names a missing key, reopen this file and compare that key with the provider guide. Keep root .env synchronized only for values used by database migrations; copying it alone does not configure Next.js.",
    ],
    code: "corepack pnpm --filter @supastack/web dev",
    links: [
      { href: "/docs/reference/environment", label: "Look up a configuration key" },
      ...preparationLinks.slice(1),
    ],
  },
  "web/deployment": {
    id: "release-order",
    title: "Prepare a public app in this order",
    paragraphs: [
      "Deployment means running your app on a hosting service so other people can visit it. localhost is accessible only in your development environment. First finish real database-backed sign-in locally, choose a hosting guide below, create a separate test database, and configure the host's environment settings with the actual public HTTPS app URL. Keep local demonstration settings separate from the public app.",
      "In a second terminal at the repository root, run the Web checks below. A successful build creates a production version on your computer; it does not upload or publish it. Do not confuse corepack pnpm --filter @supastack/web start with deployment: start runs the previously built version locally. Run it only after stopping the development server on port 3000.",
      "Follow the chosen host's guide for migration, environment and launch steps. Test sign-up, an email code, saved account data after a restart and a paid feature in the provider's sandbox before opening sales. A mobile or desktop client must point to this running HTTPS backend. Releasing a native app is a separate step documented in its platform's distribution guide.",
    ],
    code: "corepack pnpm --filter @supastack/web typecheck\ncorepack pnpm --filter @supastack/web build",
    links: [
      { href: "/docs/deploy/managed-hosting", label: "Deploy with managed hosting" },
      { href: "/docs/deploy/coolify-vps", label: "Deploy on a server with Coolify" },
      { href: "/docs/web/database", label: "Prepare database-backed sign-in" },
    ],
  },
  mobile: {
    id: "start-preview",
    title: "Your first Mobile session",
    paragraphs: [
      "Follow the Mobile tutorial below from a computer, with a phone or installed simulator nearby. You will install the project, write a public API address in apps/mobile/.env.local and scan an Expo QR code. Expo is the development tool that opens your React Native screens on a device.",
      "The Next.js API and shared server packages remain the source for accounts, data and permissions: this is the running Web backend your phone talks to. Expo's QR server only delivers the screen code. A successful preview does not mean the backend, sign-in or store purchases have been configured; the tutorial shows how to test each boundary in order.",
    ],
    links: [
      { href: "/docs/mobile/local-setup", label: "Follow the complete Mobile first-run tutorial" },
      ...preparationLinks,
    ],
  },
  "mobile/entitlements": {
    id: "read-status",
    title: "Understand the access status shown on your phone",
    paragraphs: [
      "An entitlement is permission to use a paid feature. It belongs to the active workspace, the group of account data your team uses. First complete native sign-in, then open the phone app's Settings → Billing. Read the displayed access status; loading or an error does not mean you have a subscription.",
      "With purchases off, the app should not offer store checkout. To sell access, complete the RevenueCat purchase guide below and test in a native development build. After a test purchase, reopen Billing and confirm the server reports active access; after expiry, confirm the feature is locked again. If a purchase succeeds but access does not refresh, use Restore purchases and check the backend connection rather than buying a second time.",
    ],
    links: [
      { href: "/docs/mobile/authentication", label: "Sign in from the native app" },
      {
        href: "/docs/mobile/in-app-purchases",
        label: "Configure store products and restore purchases",
      },
    ],
  },
  "mobile/store-submission": {
    id: "first-submission",
    title: "Prepare your first store submission step by step",
    paragraphs: [
      "First create and test a native development build using Mobile builds. A store submission sends the compiled app and its listing to Google or Apple for review; it is not the same as opening an Expo Go preview. You need your own Expo and relevant store developer accounts, a tested HTTPS backend, final app name/icon, screenshots, support contact and a public privacy-policy URL.",
      "Open apps/mobile/app.json in the editor and set the app name, slug, ios.bundleIdentifier and android.package for your own product before the first upload. Open apps/mobile/eas.json and replace the iOS submission team's app identifiers with your own where required. The shipped identifiers are examples. Read Mobile builds for the exact fields and ask your coding agent to review the two files before building.",
      "If eas is not installed, run npm install --global eas-cli. From the repository root use the login command below, finish browser authentication, then select the build command for one platform in Build, then submit. Read the build's dashboard logs; wait for a successful .aab or .ipa before attempting submission. EAS prompts for project linking and signing credentials; these belong to your accounts, not the kit provider's.",
      "After the binary is uploaded, open your app in Play Console or App Store Connect, complete the listing and required questionnaires, add working reviewer sign-in instructions, then submit for review there. Uploading an internal draft is not a public release. If review rejects it, open the exact policy link in the rejection and correct that issue before resubmitting.",
    ],
    code: "corepack pnpm --filter @supastack/mobile exec eas login",
    links: [
      { href: "/docs/mobile/builds", label: "Prepare the native build and identifiers" },
      {
        href: "https://docs.expo.dev/submit/introduction/",
        label: "Expo's current store submission instructions",
      },
      {
        href: "https://developer.apple.com/app-store/review/guidelines/",
        label: "Apple's current App Review guidelines",
      },
      {
        href: "https://support.google.com/googleplay/android-developer/answer/9859455",
        label: "Google Play release instructions",
      },
    ],
  },
  modules: {
    id: "plain-language",
    title: "Read the foundation in plain language",
    paragraphs: [
      "Authentication checks who signed in. A session remembers that sign-in. A workspace keeps a person's or team's records together. Billing records payments; an entitlement grants access to a feature. A job runs work outside a page request. Transactional email sends messages triggered by app actions, such as sign-in codes, rather than marketing outreach.",
      "An adapter connects one service to the same app interface. Local or fake adapters let you explore without provider accounts. When you need a real service, select one provider and follow its setup guide; you do not need to configure every module at once. Begin with database and sign-in, then enable payments, AI and background work only as your product needs them.",
    ],
    links: [
      { href: "/docs/web/database", label: "Start with persistent data" },
      { href: "/docs/modules/auth", label: "Understand real sign-in" },
      { href: "/docs/reference/guides", label: "Find the setup guide for a feature" },
    ],
  },
  "modules/workspaces": {
    id: "try-workspaces",
    title: "Try a personal workspace and a team",
    paragraphs: [
      "A workspace is a separate container for accounts, content and permissions. Complete database-backed sign-in first. Open the dashboard and note the current workspace name. Use the workspace switcher to choose another workspace you belong to; the displayed records should change to that workspace's records.",
      "To try a team, follow Organizations to create one, invite a second test email and accept that invitation in a private browser window signed in as that second account. Confirm a member sees that team's records while an unrelated account cannot open them. Owner and admin roles manage the team; member access is narrower. Keep the two accounts in separate browser sessions during this test.",
      "If you ask an agent to add a new product table or screen, explicitly request workspaceId on every user-owned record and server-side membership checks for every read and write. A workspace ID in a URL identifies the workspace; it does not grant access. Have the agent test an unrelated account before using the screen with real customer data.",
    ],
    links: [
      { href: "/docs/web/organizations", label: "Create a team and invite members" },
      {
        href: "/docs/security/workspace-isolation",
        label: "Verify records stay private to their workspace",
      },
    ],
  },
  "modules/auth": {
    id: "first-login",
    title: "Create and verify a real account",
    paragraphs: [
      "Authentication means proving who is using the app. Start Postgres and run migrations using the database guide first, then leave the Web server running. Open http://localhost:3000/auth, choose email/password sign-up, enter your name, email and password, and submit. Keep EMAIL_PROVIDER=local for this first test.",
      "When a flow requests an email code, open http://localhost:3000/mail-preview in another browser tab, find the most recent message for that address and copy its code back into the sign-in form. Request a fresh code if it expires. These messages stay in the local outbox; repeatedly checking an external inbox will not find them. Sign out, then sign in again to confirm the database-backed account works.",
      "If sign-up reports a database connection or missing-table error, finish database setup instead of enabling social login. Google, GitHub, Apple, X and Microsoft buttons need their own provider application and callback settings; enable one only after its provider guide is complete. Better Auth is the shipped default engine and does not need a paid authentication account for local email sign-in.",
    ],
    links: [
      { href: "/docs/web/database", label: "Start Postgres before creating an account" },
      { href: "/docs/modules/email-otp", label: "Use and troubleshoot email sign-in codes" },
      { href: "/docs/providers/google-oauth", label: "Configure Google sign-in" },
    ],
  },
  "modules/ai": {
    id: "first-ai",
    title: "Try fake AI, then choose a real provider",
    paragraphs: [
      "For your first result, follow the Web tutorial's /ai task: start the local flow, queue a prompt, run it and view the result. AI_PROVIDER=fake returns a repeatable demonstration response without sending data to an external model or using a paid API key.",
      "For real generation, first configure persisted accounts, choose an AI provider and follow AI configuration below. Add a model and its price to the database catalog, choose the permitted models for each alias, and grant the workspace the required access. An alias such as fast is a friendly choice shown to the user; it is not itself an external provider's model ID.",
      "A background AI task also needs the configured jobs service. If no model choices are shown, inspect the catalog and alias policy before retrying. If access is denied, inspect the active workspace's entitlement. Keep all provider API keys in the Web server's configuration, not the browser, mobile app or desktop window.",
    ],
    links: [
      { href: "/docs/web/local-setup", label: "Try the credential-free AI demonstration" },
      { href: "/docs/modules/ai-configuration", label: "Configure real AI generation" },
      { href: "/docs/modules/model-catalog", label: "Add allowed models and prices" },
      { href: "/docs/modules/jobs", label: "Configure background task execution" },
    ],
  },
  "modules/billing": {
    id: "first-billing",
    title: "Choose and test your payment service",
    paragraphs: [
      "Billing handles payments. Access permissions are stored separately as entitlements. Complete persisted account setup, then open /billing in the running Web app to see the plan interface. With BILLING_PROVIDER=local, you are exploring local behavior rather than collecting real money.",
      "Choose one supported payment provider, follow its setup guide, create your own test product and price, and copy the named server settings into apps/web/.env.local. Save and restart the Web server. Complete one checkout using that provider's sandbox instructions, then inspect the workspace's access state after the provider's webhook arrives. A webhook is the provider's signed message to your server about a payment event.",
      "A success page alone does not unlock features. If checkout completes but access remains inactive, check the provider's webhook delivery and your server's event processing before repeating payment. Test cancellation and expired access as well. Phone purchases use the separate RevenueCat/store setup, not this Web checkout.",
    ],
    links: [
      {
        href: "/docs/modules/billing-configuration",
        label: "Choose a billing adapter and its settings",
      },
      { href: "/docs/modules/product-plans", label: "Set your own products and prices" },
      { href: "/docs/providers/stripe", label: "Set up Stripe in a test environment" },
    ],
  },
  "modules/email": {
    id: "first-message",
    title: "Read your first local message, then enable delivery",
    paragraphs: [
      "Transactional email means a message triggered by an app action, such as a sign-in code or task result. With the Web server running, keep EMAIL_PROVIDER=local in apps/web/.env.local. Complete database setup, request a sign-in code at /auth, then open /mail-preview and inspect the latest message. A local message appearing here is not an email delivered to your external inbox.",
      "To send real messages, choose one email provider, create its account, verify a domain you control and follow its dedicated guide. Put the named API key and sender address in apps/web/.env.local, save and restart the Web server. Request one new sign-in code, then check both the provider's delivery log and the destination inbox, including spam. Domain verification and sender approval can take time.",
      "If the message fails, inspect the delivery error and sender verification before requesting repeatedly. The /mail-preview route is development-only and returns 404 in production. Keep marketing outreach separate from this transactional sender so a newsletter campaign cannot disrupt account verification mail.",
    ],
    links: [
      {
        href: "/docs/modules/email-configuration",
        label: "Choose a mail provider and sender address",
      },
      { href: "/docs/providers/resend", label: "Enable Resend delivery" },
    ],
  },
  "modules/observability": {
    id: "first-diagnosis",
    title: "Find useful information when an action fails",
    paragraphs: [
      "Observability means seeing what your app did. Begin with the terminal running your Web server: repeat one failing action and read the first error and any correlation ID, a label linking messages from the same request. Share the command, time and sanitized error when asking for help; do not share .env files or tokens.",
      "For hosted error reports, follow Health and operations to configure the supported monitoring settings in apps/web/.env.local or the host's environment dashboard. Save and restart the server. Trigger a controlled test failure in a test environment and confirm it appears with the correct workspace context. Monitoring being configured does not prove it received an event.",
      "ALERT_WEBHOOK_URL is an optional HTTPS destination for job and terminal webhook-delivery failure alerts. If you need it, create a compatible incoming endpoint and save its URL server-side; otherwise leave it empty. Ask an agent to simulate one failure and confirm exactly one alert, with no secrets in its text. Do not trigger paid work or failures in customer accounts for this test.",
    ],
    links: [
      { href: "/docs/security/health", label: "Check application health and operational settings" },
      { href: "/docs/web/troubleshooting", label: "Diagnose an error in the local terminal" },
    ],
  },
};

/** Keep existing routes, anchors and technical reference sections. */
export function withBeginnerInstructions(entries: readonly Guide[]): Guide[] {
  return entries.map((guide) => {
    const replacement = firstRunGuides.find((candidate) => candidate.slug === guide.slug);
    if (replacement) return replacement;
    const walkthrough = foundationWalkthroughs[guide.slug];
    return walkthrough ? { ...guide, sections: [walkthrough, ...guide.sections] } : guide;
  });
}

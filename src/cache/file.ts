/**
 * @file file.ts — Mock del filesystem para modo web (sin Tauri/Go)
 *
 * Este archivo es el **fallback** cuando el sidecar Go no está disponible.
 * En `tauri dev` el FS real viene de `src/cache/fsCache.ts` → `fsService` → Rust → Go.
 * En `vite dev` (navegador) seguimos usando este mock para desarrollar el UI sin backend.
 *
 * ## Cuándo se usa
 * ```ts
 * // App.tsx
 * import { archs } from "./cache/file"          // mock
 * import { fsCache } from "./cache/fsCache"     // real + fallback
 * const root = await fsCache.init(archs) // intenta Go, si falla usa archs
 * ```
 *
 * ## Estructura
 * `archs` es un `Directory` con `directorys` anidados y `files`.
 * `listFiles` es un índice plano de archivos con su `data` (contenido).
 * Ambos son usados por `fileService.getDirectoryByPath` sincrónico.
 */

import { Directory, ListFiles } from "../types/cache";

// Sirve para probar visualmente la recursividad del explorador.
export const archs: Directory = {
    type: "dir",
    path: "/",
    name: "Bjksdqa",
    directorys: [
        {
            path: "/src/",
            type: "dir",
            name: "src",
            directorys: [
                {
                    path: "/src/components/",
                    type: "dir",
                    name: "components",
                    directorys: [
                        {
                            path: "/src/components/ui/",
                            type: "dir",
                            name: "ui",
                            directorys: [
                                {
                                    path: "/src/components/ui/forms/",
                                    type: "dir",
                                    name: "forms",
                                    directorys: [],
                                    files: [
                                        { path: "/src/components/ui/forms/LoginForm.tsx", name: "LoginForm.tsx", type: "file" },
                                        { path: "/src/components/ui/forms/SignupForm.tsx", name: "SignupForm.tsx", type: "file" }
                                    ]
                                },
                                {
                                    path: "/src/components/ui/layout/",
                                    type: "dir",
                                    name: "layout",
                                    directorys: [],
                                    files: [
                                        { path: "/src/components/ui/layout/Header.tsx", name: "Header.tsx", type: "file" },
                                        { path: "/src/components/ui/layout/Sidebar.tsx", name: "Sidebar.tsx", type: "file" }
                                    ]
                                }
                            ],
                            files: [
                                { path: "/src/components/ui/Button.tsx", name: "Button.tsx", type: "file" },
                                { path: "/src/components/ui/Card.tsx", name: "Card.tsx", type: "file" }
                            ]
                        },
                        {
                            path: "/src/components/features/",
                            type: "dir",
                            name: "features",
                            directorys: [
                                {
                                    path: "/src/components/features/dashboard/",
                                    type: "dir",
                                    name: "dashboard",
                                    directorys: [],
                                    files: [
                                        { path: "/src/components/features/dashboard/Overview.tsx", name: "Overview.tsx", type: "file" },
                                        { path: "/src/components/features/dashboard/Stats.tsx", name: "Stats.tsx", type: "file" }
                                    ]
                                }
                            ],
                            files: [
                                { path: "/src/components/features/Users.tsx", name: "Users.tsx", type: "file" }
                            ]
                        }
                    ],
                    files: [
                        { path: "/src/App.tsx", name: "App.tsx", type: "file" },
                        { path: "/src/main.tsx", name: "main.tsx", type: "file" }
                    ]
                },
                {
                    path: "/src/hooks/",
                    type: "dir",
                    name: "hooks",
                    directorys: [
                        {
                            path: "/src/hooks/useAuth/",
                            type: "dir",
                            name: "useAuth",
                            directorys: [],
                            files: [
                                { path: "/src/hooks/useAuth/index.ts", name: "index.ts", type: "file" },
                                { path: "/src/hooks/useAuth/types.ts", name: "types.ts", type: "file" }
                            ]
                        }
                    ],
                    files: [
                        { path: "/src/hooks/useFetch.ts", name: "useFetch.ts", type: "file" },
                        { path: "/src/hooks/useLocalStorage.ts", name: "useLocalStorage.ts", type: "file" }
                    ]
                }
            ],
            files: [
                { path: "/src/index.css", name: "index.css", type: "file" },
                { path: "/src/global.d.ts", name: "global.d.ts", type: "file" }
            ]
        },
        {
            path: "/public/",
            type: "dir",
            name: "public",
            directorys: [
                {
                    path: "/public/assets/",
                    type: "dir",
                    name: "assets",
                    directorys: [
                        {
                            path: "/public/assets/icons/",
                            type: "dir",
                            name: "icons",
                            directorys: [],
                            files: [
                                { path: "/public/assets/icons/logo.svg", name: "logo.svg", type: "file" },
                                { path: "/public/assets/icons/favicon.ico", name: "favicon.ico", type: "file" }
                            ]
                        }
                    ],
                    files: [
                        { path: "/public/assets/banner.png", name: "banner.png", type: "file" }
                    ]
                }
            ],
            files: [
                { path: "/public/manifest.json", name: "manifest.json", type: "file" }
            ]
        },
        {
            path: "/docs/",
            type: "dir",
            name: "docs",
            directorys: [
                {
                    path: "/docs/guides/",
                    type: "dir",
                    name: "guides",
                    directorys: [],
                    files: [
                        { path: "/docs/guides/installation.md", name: "installation.md", type: "file" },
                        { path: "/docs/guides/usage.md", name: "usage.md", type: "file" }
                    ]
                }
            ],
            files: [
                { path: "/docs/README.md", name: "README.md", type: "file" }
            ]
        }
    ],
    files: [
        { path: "/package.json", name: "package.json", type: "file" },
        { path: "/tsconfig.json", name: "tsconfig.json", type: "file" },
        { path: "/README.md", name: "README.md", type: "file" }
    ]
};

export const listFiles: ListFiles = {
    files: [
        { path: "/src/App.tsx", name: "App.tsx", data: "Contenido de App.tsx" },
        { path: "/src/main.tsx", name: "main.tsx", data: "Contenido de main.tsx" },
        { path: "/src/index.css", name: "index.css", data: "Contenido de index.css" },
        { path: "/src/global.d.ts", name: "global.d.ts", data: "declare global {}" },
        { path: "/src/components/ui/Button.tsx", name: "Button.tsx", data: "Contenido de Button.tsx" },
        { path: "/src/components/ui/Card.tsx", name: "Card.tsx", data: "Contenido de Card.tsx" },
        { path: "/src/components/ui/forms/LoginForm.tsx", name: "LoginForm.tsx", data: "Contenido de LoginForm.tsx" },
        { path: "/src/components/ui/forms/SignupForm.tsx", name: "SignupForm.tsx", data: "Contenido de SignupForm.tsx" },
        { path: "/src/components/ui/layout/Header.tsx", name: "Header.tsx", data: "Contenido de Header.tsx" },
        { path: "/src/components/ui/layout/Sidebar.tsx", name: "Sidebar.tsx", data: "Contenido de Sidebar.tsx" },
        { path: "/src/components/features/Users.tsx", name: "Users.tsx", data: "Contenido de Users.tsx" },
        { path: "/src/components/features/dashboard/Overview.tsx", name: "Overview.tsx", data: "Contenido de Overview.tsx" },
        { path: "/src/components/features/dashboard/Stats.tsx", name: "Stats.tsx", data: "Contenido de Stats.tsx" },
        { path: "/src/hooks/useFetch.ts", name: "useFetch.ts", data: "Contenido de useFetch.ts" },
        { path: "/src/hooks/useLocalStorage.ts", name: "useLocalStorage.ts", data: "Contenido de useLocalStorage.ts" },
        { path: "/src/hooks/useAuth/index.ts", name: "index.ts", data: "Contenido de index.ts" },
        { path: "/src/hooks/useAuth/types.ts", name: "types.ts", data: "Contenido de types.ts" },
        { path: "/public/assets/banner.png", name: "banner.png", data: "binary image" },
        { path: "/public/assets/icons/logo.svg", name: "logo.svg", data: "<svg />" },
        { path: "/public/assets/icons/favicon.ico", name: "favicon.ico", data: "favicon" },
        { path: "/public/manifest.json", name: "manifest.json", data: "{ \"name\": \"demo\" }" },
        { path: "/docs/README.md", name: "README.md", data: "Contenido de README.md" },
        { path: "/docs/guides/installation.md", name: "installation.md", data: "Contenido de installation.md" },
        { path: "/docs/guides/usage.md", name: "usage.md", data: "Contenido de usage.md" },
        { path: "/package.json", name: "package.json", data: "{ \"name\": \"demo\" }" },
        { path: "/tsconfig.json", name: "tsconfig.json", data: "{ \"compilerOptions\": {} }" },
        { path: "/README.md", name: "README.md", data: "Contenido de README.md" }
    ]
} 
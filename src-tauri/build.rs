fn main() {
    // Intentar compilar el sidecar Go automáticamente durante `cargo build`
    // Esto asegura que `src-tauri/binaries/killer-go` exista sin paso manual.
    //
    // En CI sin Go instalado, no falla el build de Rust: solo loguea warning
    // y el runtime de Rust hará fallback a mock.

    // Tauri build default
    tauri_build::build();

    // Intentar `go build`
    let go_bin = which_go();
    if go_bin.is_none() {
        println!("cargo:warning=Go toolchain not found — skipping killer-go sidecar build (frontend will use mock)");
        return;
    }

    let go = go_bin.unwrap();
    println!("cargo:warning=Building Go sidecar with {}", go);

    // Crear carpeta de binaries si no existe (absoluta desde CARGO_MANIFEST_DIR)
    let manifest_dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR"));
    let out_dir = manifest_dir.join("binaries");
    if let Err(e) = std::fs::create_dir_all(&out_dir) {
        println!("cargo:warning=Failed to create binaries dir: {}", e);
        return;
    }

    let go_dir = manifest_dir.join("../go");
    // Si no existe go_dir (ej: build standalone), fallback a manifest_dir/go
    let go_dir = if go_dir.exists() {
        go_dir
    } else {
        manifest_dir.join("go")
    };

    let out_main = out_dir.join("killer-go");
    let out_triple = out_dir.join("killer-go-x86_64-unknown-linux-gnu");

    // go build debe ejecutarse con cwd = go_dir y construir "." (no "../go")
    // El bug anterior era `go build -o binaries/killer-go ../go` desde src-tauri,
    // que en Go >=1.16 falla con "cannot find main module" porque el main module
    // se busca respecto al cwd (src-tauri, sin go.mod) y ../go no se resuelve como módulo.
    let status = std::process::Command::new(&go)
        .args(["build", "-o", &out_main.to_string_lossy().to_string(), "."])
        .current_dir(&go_dir)
        .status();

    match status {
        Ok(s) if s.success() => {
            println!("cargo:warning=Go sidecar built at {}", out_main.display());
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let _ = std::fs::set_permissions(&out_main, std::fs::Permissions::from_mode(0o755));
            }
            // Copiar también al nombre con triple para que Tauri lo encuentre en bundling
            if let Err(e) = std::fs::copy(&out_main, &out_triple) {
                println!("cargo:warning=Failed to copy to triple binary: {}", e);
            } else {
                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;
                    let _ = std::fs::set_permissions(&out_triple, std::fs::Permissions::from_mode(0o755));
                }
                println!("cargo:warning=Go sidecar also copied to {}", out_triple.display());
            }
        }
        Ok(s) => {
            println!("cargo:warning=Go build failed with status {} for {} (go_dir={})", s, out_main.display(), go_dir.display());
        }
        Err(e) => {
            println!("cargo:warning=Failed to run go build: {} for {}", e, out_main.display());
        }
    }
}

fn which_go() -> Option<String> {
    // Buscar `go` en PATH
    if let Ok(path) = std::env::var("PATH") {
        for dir in path.split(':') {
            let candidate = std::path::Path::new(dir).join("go");
            if candidate.exists() {
                return Some(candidate.to_string_lossy().to_string());
            }
        }
    }
    // Intentar `go` directo (deja que Command resuelva)
    // Probar ejecutando `go version`
    if std::process::Command::new("go")
        .arg("version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
    {
        return Some("go".to_string());
    }
    // También probar /usr/local/go/bin/go
    let alt = "/usr/local/go/bin/go";
    if std::path::Path::new(alt).exists() {
        return Some(alt.to_string());
    }
    None
}

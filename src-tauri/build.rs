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

    // Crear carpeta de binaries si no existe
    let out_dir = std::path::Path::new("binaries");
    if let Err(e) = std::fs::create_dir_all(out_dir) {
        println!("cargo:warning=Failed to create binaries dir: {}", e);
        return;
    }

    // Detectar triple de Tauri para nombre de binario con sufijo
    // En dev, `killer-go` sin sufijo también funciona (resolve_binary_path lo busca)
    let outputs = [
        "binaries/killer-go", // dev universal
        "binaries/killer-go-x86_64-unknown-linux-gnu",
    ];

    for out in outputs {
        let status = std::process::Command::new(&go)
            .args(["build", "-o", out, "../go"])
            .current_dir(env!("CARGO_MANIFEST_DIR"))
            .status();

        match status {
            Ok(s) if s.success() => {
                println!("cargo:warning=Go sidecar built at {}", out);
                // Hacer ejecutable
                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;
                    let _ = std::fs::set_permissions(out, std::fs::Permissions::from_mode(0o755));
                }
            }
            Ok(s) => {
                println!("cargo:warning=Go build failed with status {} for {}", s, out);
            }
            Err(e) => {
                println!("cargo:warning=Failed to run go build: {} for {}", e, out);
            }
        }
        // Solo necesitamos construir una vez; el loop es por si queremos múltiples triples
        break;
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

module killer

go 1.22

// No dependencias externas: usamos solo stdlib para mantener el binario
// sidecar ligero y portátil. Si en el futuro necesitas watcher o mime,
// añade: github.com/fsnotify/fsnotify, github.com/gabriel-vasile/mimetype

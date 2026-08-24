import { listFiles } from "../cache/file";
import { Directory, Fille } from "../types/cache";

export const fileService = {
    getFileByPath(path: string): Fille | null {
        for (const file of listFiles.files) {
            if (file.path == path) return file
        }
        return null
    },
    getDirectoryByPath(path: string, archss: Directory): Directory | null {
        if (path === archss.path) return archss;

        for (const dir of archss.directorys) {
            const found = this.getDirectoryByPath(path, dir);
            if (found) return found;
        }

        return null;
    },

    // Devuelve el directorio que CONTIENE al directorio con esa ruta.
    // null si la ruta es la raíz (no se puede subir más).
    getParentByPath(path: string, archss: Directory): Directory | null {
        for (const dir of archss.directorys) {
            if (dir.path === path) return archss;

            const found = this.getParentByPath(path, dir);
            if (found) return found;
        }

        return null;
    }
}
import type { OpenedFile } from "../types/storage";

export const storageService = {
    directionsDir: {
        setDirection(direction: string) {
            localStorage.setItem("direction", direction)
        },
        getDirection(): string | null {
            return localStorage.getItem("direction")
        },
        deleteDirection() {
            localStorage.removeItem("direction")
        }
    },

    filesOpen: {
        path: {
            getFilesList(): string[] | null {
                let files = localStorage.getItem("openedFiles")
                if (!files) return null
                let files1 = files.split(":")
                return files1
            },
            getFilesString(): string | null {
                return localStorage.getItem("openedFiles")
            },
            setFiles(files: string) {
                localStorage.setItem("openedFiles", files)
            },
            setNewFile(path: string) {
                let files = this.getFilesString()
                if (!files) {
                    localStorage.setItem("openedFiles", path)
                    return
                }
                this.setFiles(files + ":" + path)
            },
            removeFile(path: string) {
                let files = this.getFilesList()
                if (!files) return
                let index = files.indexOf(path)
                if (index === -1) return
                files.splice(index, 1)
                this.setFiles(files.join(":"))
            },
            fileExist(path: string): boolean {
                let files = this.getFilesList()
                if(!files) return false 
                let i=files.indexOf(path)
                if(i!==-1) return true
                else return false
            }
        },
        file: {

            getFiles(): OpenedFile[] {

                const paths = storageService.filesOpen.path.getFilesList()

                if (!paths) return []

                return paths.map(path => ({
                    path,
                    name: path.split("/").pop() ?? path
                }))
            }
        }

    }
}
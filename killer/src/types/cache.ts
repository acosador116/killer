type Directory = {
    type: 'dir';
    path: string;
    name: string;
    directorys: Directory[];
    files: FilleDeck[];
}

type FilleDeck = {
    type: "file";
    name: string;
    path: string;
}

type ListFiles = {
    files: Fille[];
}

type Fille = {
    path: string;
    name: string;
    data: string;
    extension: string;
}

export type {Fille, ListFiles, Directory, FilleDeck}
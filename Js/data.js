// data.js
const IMG_DIR = "Systems/";
const IMG_EXT = ".svg";
const BG_DIR = "Systems/Wallpapers/";
const BG_EXT = ".jpg";

// ** NUEVAS CONSTANTES PARA LA CARGA DE JUEGOS **
const GAMES_BASE_DIR = "Games/";
const GAME_IMG_SUFFIX = "-thumb";
const GAME_IMG_EXT = ".webp"; // Asumo .webp; ajústalo si usas otro formato (ej: .png o .jpg)

const menuItems = [
    "3ds",
    "bios",
    "dos",
    "dreamcast",
    "gamegear",
    "gb",
    "gba",
    "gbc",
    "gc",
    "mame",
    "megadrive",
    "n64",
    "naomi2",
    "nds",
    "nes",
    "ps2",
    "ps3",
    "psp",
    "psx",
    "saturn",
    "snes",
    "snes-msu",
    "wii",
    "wiiu",
    "xbox"
];

window.IMG_DIR = IMG_DIR;
window.IMG_EXT = IMG_EXT;
window.BG_DIR = BG_DIR;
window.BG_EXT = BG_EXT;
// ** EXPORTAR NUEVAS CONSTANTES **
window.GAMES_BASE_DIR = GAMES_BASE_DIR;
window.GAME_IMG_SUFFIX = GAME_IMG_SUFFIX;
window.GAME_IMG_EXT = GAME_IMG_EXT;
window.menuItems = menuItems;
use std::fs;
use std::path::Path;

// Tauri's Windows resource builder expects src-tauri/icons/icon.ico.
// Keep a tiny valid fallback icon in source so a fresh clone builds without
// requiring a separate binary asset to be committed.
const FALLBACK_ICON: &[u8] = &[
    0,0,1,0,1,0,1,1,0,0,0,0,0,0,48,0,0,0,22,0,0,0,
    40,0,0,0,1,0,0,0,2,0,0,0,1,0,32,0,0,0,0,0,4,0,
    0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,163,86,115,255,
    0,0,0,0,
];

fn ensure_fallback_icon() {
    let icon_dir = Path::new("icons");
    let icon_path = icon_dir.join("icon.ico");
    if icon_path.exists() {
        return;
    }
    fs::create_dir_all(icon_dir).expect("failed to create src-tauri/icons");
    fs::write(&icon_path, FALLBACK_ICON).expect("failed to create fallback icons/icon.ico");
    println!("cargo:rerun-if-changed=build.rs");
}

fn main() {
    ensure_fallback_icon();
    tauri_build::build();
}

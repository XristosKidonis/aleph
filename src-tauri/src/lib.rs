use std::fs;
use std::io::Read;
use std::path::Path;
use tauri::path::BaseDirectory;
use tauri::Manager;

/// Los primeros 100 bytes de un archivo SQLite son su cabecera: traen, entre otras cosas, el contador de
/// cambios que sube con cada escritura. Junto con el tamaño sirven de huella barata: si coinciden, la base
/// instalada es la misma que la incluida y no hace falta copiar 175 MB otra vez.
fn huella(ruta: &Path) -> Option<(u64, [u8; 100])> {
    let largo = fs::metadata(ruta).ok()?.len();
    let mut cabecera = [0u8; 100];
    fs::File::open(ruta).ok()?.read_exact(&mut cabecera).ok()?;
    Some((largo, cabecera))
}

/// Copia la base bíblica incluida en la app a la carpeta donde el plugin SQL abre sus bases.
/// Solo la copia si falta o si cambió de verdad (antes se copiaba en cada versión nueva de la app, aunque
/// los textos fueran los mismos). Se copia a un archivo temporal y se renombra al final: si la app se
/// cierra a mitad de camino, no queda una base cortada.
fn instalar_biblias(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let origen = app.path().resolve("biblias.db", BaseDirectory::Resource)?;
    let carpeta = app.path().app_config_dir()?;
    fs::create_dir_all(&carpeta)?;
    let destino = carpeta.join("biblias.db");
    let marca = carpeta.join("biblias.version");
    let version = app.package_info().version.to_string();
    let instalada = fs::read_to_string(&marca).unwrap_or_default();
    if destino.exists() && instalada.trim() == version {
        return Ok(());
    }
    if !destino.exists() || huella(&origen) != huella(&destino) {
        let temporal = carpeta.join("biblias.db.copiando");
        fs::copy(&origen, &temporal)?;
        fs::rename(&temporal, &destino)?;
        // restos del diario de la base anterior (modo WAL) no deben aplicarse sobre la nueva
        for resto in ["biblias.db-wal", "biblias.db-shm"] {
            let _ = fs::remove_file(carpeta.join(resto));
        }
    }
    fs::write(&marca, &version)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Actualizaciones automáticas: busca en GitHub Releases (latest.json firmado)
            #[cfg(desktop)]
            {
                app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
                app.handle().plugin(tauri_plugin_process::init())?;
            }
            instalar_biblias(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error al iniciar Aleph");
}

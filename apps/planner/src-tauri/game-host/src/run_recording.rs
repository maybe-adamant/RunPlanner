//! Run recording's host side: the Hades II save folder, change detection over
//! its profile saves, the recent-runs document folder and its raw-save byte
//! folders. The host reads and stores bytes only; the planner decodes saves and
//! owns every run rule.

use std::collections::BTreeMap;
use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

use crate::atomic_file;

/// Steam application id of Hades II; Proton keeps its prefix under this id.
pub const HADES_II_STEAM_APP_ID: &str = "1145350";
const SAVE_FOLDER_NAME: &str = "Hades II";
const MAX_SAVE_BYTES: u64 = 64 * 1024 * 1024;
const MAX_RECENT_RUN_BYTES: u64 = 32 * 1024 * 1024;

/// `%USERPROFILE%\Saved Games\Hades II`.
pub fn windows_save_folder(user_profile: &Path) -> PathBuf {
    user_profile.join("Saved Games").join(SAVE_FOLDER_NAME)
}

/// The Windows save folder inside a Steam library's Proton prefix for Hades II.
pub fn proton_save_folder(steam_library: &Path) -> PathBuf {
    steam_library
        .join("steamapps")
        .join("compatdata")
        .join(HADES_II_STEAM_APP_ID)
        .join("pfx/drive_c/users/steamuser/Saved Games")
        .join(SAVE_FOLDER_NAME)
}

/// Linux Steam roots in preference order: the native install's data folder
/// (`$XDG_DATA_HOME/Steam`, else `~/.local/share/Steam`), the `~/.steam` links,
/// then the Flatpak's.
pub fn linux_steam_roots(xdg_data_home: Option<&Path>, home: Option<&Path>) -> Vec<PathBuf> {
    let mut roots = Vec::new();
    // The XDG base directory rules ignore a relative XDG_DATA_HOME.
    match xdg_data_home.filter(|path| path.is_absolute()) {
        Some(data) => roots.push(data.join("Steam")),
        None => {
            if let Some(home) = home {
                roots.push(home.join(".local/share/Steam"));
            }
        }
    }
    if let Some(home) = home {
        roots.push(home.join(".steam/steam"));
        roots.push(home.join(".steam/root"));
        roots.push(home.join(".var/app/com.valvesoftware.Steam/.local/share/Steam"));
    }
    roots
}

/// Library folders named by a Steam `libraryfolders.vdf`, in file order.
pub fn library_folders_from_vdf(text: &str) -> Vec<PathBuf> {
    // VDF values are quoted strings; a library's folder is the value after a `path` key.
    let strings: Vec<&str> = text.split('"').skip(1).step_by(2).collect();
    strings
        .windows(2)
        .filter(|pair| pair[0] == "path" && !pair[1].is_empty())
        .map(|pair| PathBuf::from(pair[1].replace("\\\\", "\\")))
        .collect()
}

/// Proton save-folder candidates: each Steam root, then every library its
/// `libraryfolders.vdf` names, without repeats.
pub fn proton_save_candidates(steam_roots: &[PathBuf]) -> Vec<PathBuf> {
    let mut libraries: Vec<PathBuf> = Vec::new();
    for root in steam_roots {
        libraries.push(root.clone());
        if let Ok(text) = fs::read_to_string(root.join("steamapps/libraryfolders.vdf")) {
            libraries.extend(library_folders_from_vdf(&text));
        }
    }
    let mut candidates: Vec<PathBuf> = Vec::new();
    for library in libraries {
        let candidate = proton_save_folder(&library);
        if !candidates.contains(&candidate) {
            candidates.push(candidate);
        }
    }
    candidates
}

/// Save-folder candidates for this platform in preference order.
pub fn save_folder_candidates() -> Vec<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        std::env::var_os("USERPROFILE")
            .map(|profile| vec![windows_save_folder(Path::new(&profile))])
            .unwrap_or_default()
    }
    #[cfg(target_os = "linux")]
    {
        let xdg_data_home = std::env::var_os("XDG_DATA_HOME").map(PathBuf::from);
        let home = std::env::var_os("HOME").map(PathBuf::from);
        proton_save_candidates(&linux_steam_roots(
            xdg_data_home.as_deref(),
            home.as_deref(),
        ))
    }
    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    {
        Vec::new()
    }
}

/// The first candidate folder that exists.
pub fn discover_save_folder(candidates: &[PathBuf]) -> Option<PathBuf> {
    candidates.iter().find(|folder| folder.is_dir()).cloned()
}

/// Accepts an existing absolute folder to watch.
pub fn resolve_save_folder(path: &Path) -> Result<PathBuf, String> {
    if !path.is_absolute() || !path.is_dir() {
        return Err(format!("The save folder {} was not found.", path.display()));
    }
    fs::canonicalize(path).map_err(|error| format!("Could not open {}: {error}", path.display()))
}

/// A profile save the recorder reads: `Profile<N>.sav` (the hub profile) or
/// `Profile<N>_Temp.sav` (the run checkpoint). Backups, validity flags and
/// staging files are not.
pub fn is_recorded_save(name: &str) -> bool {
    let Some(rest) = name.strip_prefix("Profile") else {
        return false;
    };
    let Some(rest) = rest.strip_suffix(".sav") else {
        return false;
    };
    let digits = rest.strip_suffix("_Temp").unwrap_or(rest);
    !digits.is_empty() && digits.len() <= 4 && digits.bytes().all(|byte| byte.is_ascii_digit())
}

/// What a poll compares: a write changes the size, the modification time or both.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct FileStamp {
    pub len: u64,
    pub modified: Option<SystemTime>,
}

/// Remembers each save's stamp between polls of one folder.
#[derive(Debug, Default)]
pub struct SaveFolderWatch {
    known: BTreeMap<String, FileStamp>,
}

impl SaveFolderWatch {
    /// The saves whose stamp is new or changed since the last poll, oldest
    /// write first. A save that disappears is forgotten, so its return reports.
    pub fn changes(&mut self, listing: Vec<(String, FileStamp)>) -> Vec<String> {
        let mut changed: Vec<(Option<SystemTime>, String)> = Vec::new();
        let mut next = BTreeMap::new();
        for (name, stamp) in listing {
            if self.known.get(&name) != Some(&stamp) {
                changed.push((stamp.modified, name.clone()));
            }
            next.insert(name, stamp);
        }
        self.known = next;
        changed.sort();
        changed.into_iter().map(|(_, name)| name).collect()
    }

    /// Lists the folder and returns its changed saves.
    pub fn poll(&mut self, folder: &Path) -> Result<Vec<String>, String> {
        Ok(self.changes(list_saves(folder)?))
    }

    /// Drops a save's stamp, so the next poll reports it again.
    pub fn forget(&mut self, name: &str) {
        self.known.remove(name);
    }

    /// The changed saves with their bytes, oldest write first. A save that
    /// cannot be read now is forgotten, so the next poll tries it again.
    pub fn read_changes(&mut self, folder: &Path) -> Result<Vec<(String, Vec<u8>)>, String> {
        let mut read = Vec::new();
        for name in self.poll(folder)? {
            match read_save(folder, &name) {
                Ok(bytes) => read.push((name, bytes)),
                Err(_) => self.forget(&name),
            }
        }
        Ok(read)
    }
}

/// The recorded saves in `folder` with their stamps.
pub fn list_saves(folder: &Path) -> Result<Vec<(String, FileStamp)>, String> {
    let entries = fs::read_dir(folder)
        .map_err(|error| format!("Could not read {}: {error}", folder.display()))?;
    let mut saves = Vec::new();
    for entry in entries.flatten() {
        let Some(name) = entry.file_name().to_str().map(str::to_owned) else {
            continue;
        };
        if !is_recorded_save(&name) {
            continue;
        }
        let Ok(metadata) = entry.metadata() else {
            continue;
        };
        if !metadata.is_file() {
            continue;
        }
        saves.push((
            name,
            FileStamp {
                len: metadata.len(),
                modified: metadata.modified().ok(),
            },
        ));
    }
    Ok(saves)
}

/// The bytes of one recorded save in `folder`.
pub fn read_save(folder: &Path, name: &str) -> Result<Vec<u8>, String> {
    if !is_recorded_save(name) {
        return Err(format!("{name} is not a profile save."));
    }
    read_limited(&folder.join(name), MAX_SAVE_BYTES)
}

fn read_limited(path: &Path, limit: u64) -> Result<Vec<u8>, String> {
    let metadata = fs::metadata(path)
        .map_err(|error| format!("Could not read {}: {error}", path.display()))?;
    if metadata.len() > limit {
        return Err(format!("{} is too large.", path.display()));
    }
    fs::read(path).map_err(|error| format!("Could not read {}: {error}", path.display()))
}

/// One save as a single binary message: the file name's UTF-8 length as a
/// little-endian `u16`, the name, then the file's bytes.
pub fn frame_save(name: &str, bytes: &[u8]) -> Vec<u8> {
    let name = name.as_bytes();
    let mut frame = Vec::with_capacity(2 + name.len() + bytes.len());
    frame.extend_from_slice(&(name.len() as u16).to_le_bytes());
    frame.extend_from_slice(name);
    frame.extend_from_slice(bytes);
    frame
}

/// A recent-run document id: letters, digits and dashes.
pub fn is_recent_run_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 64
        && id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-')
}

fn recent_run_path(folder: &Path, id: &str) -> Result<PathBuf, String> {
    if !is_recent_run_id(id) {
        return Err(format!("{id} is not a recent-run id."));
    }
    Ok(folder.join(format!("{id}.json")))
}

/// The ids of the stored recent runs, sorted.
pub fn list_recent_runs(folder: &Path) -> Result<Vec<String>, String> {
    let entries = match fs::read_dir(folder) {
        Ok(entries) => entries,
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(format!("Could not read the recent runs: {error}")),
    };
    let mut ids: Vec<String> = entries
        .flatten()
        .filter_map(|entry| {
            let name = entry.file_name().to_str()?.to_owned();
            let id = name.strip_suffix(".json")?;
            (is_recent_run_id(id) && entry.file_type().ok()?.is_file()).then(|| id.to_owned())
        })
        .collect();
    ids.sort();
    Ok(ids)
}

pub fn read_recent_run(folder: &Path, id: &str) -> Result<String, String> {
    let bytes = read_limited(&recent_run_path(folder, id)?, MAX_RECENT_RUN_BYTES)?;
    String::from_utf8(bytes).map_err(|_| format!("Recent run {id} is not text."))
}

pub fn write_recent_run(folder: &Path, id: &str, json: &str) -> Result<(), String> {
    let path = recent_run_path(folder, id)?;
    if json.len() as u64 > MAX_RECENT_RUN_BYTES {
        return Err(format!("Recent run {id} is too large."));
    }
    fs::create_dir_all(folder)
        .map_err(|error| format!("Could not create the recent runs folder: {error}"))?;
    atomic_file::write(&path, json.as_bytes(), "recent run")
}

/// Removes a stored run; one already gone counts as removed.
pub fn delete_recent_run(folder: &Path, id: &str) -> Result<(), String> {
    match fs::remove_file(recent_run_path(folder, id)?) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("Could not delete recent run {id}: {error}")),
    }
}

/// A raw-save file name: letters, digits, dashes, underscores and inner dots.
pub fn is_raw_save_name(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= 128
        && !name.starts_with('.')
        && name
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.'))
}

fn raw_save_folder(root: &Path, folder: &str) -> Result<PathBuf, String> {
    if !is_recent_run_id(folder) {
        return Err(format!("{folder} is not a raw-save folder."));
    }
    Ok(root.join(folder))
}

fn raw_save_path(root: &Path, folder: &str, name: &str) -> Result<PathBuf, String> {
    if !is_raw_save_name(name) {
        return Err(format!("{name} is not a raw-save name."));
    }
    Ok(raw_save_folder(root, folder)?.join(name))
}

fn directory_names(directory: &Path, want_directories: bool) -> Result<Vec<String>, String> {
    let entries = match fs::read_dir(directory) {
        Ok(entries) => entries,
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(Vec::new()),
        Err(error) => return Err(format!("Could not read {}: {error}", directory.display())),
    };
    let mut names: Vec<String> = entries
        .flatten()
        .filter_map(|entry| {
            let name = entry.file_name().to_str()?.to_owned();
            let kind = entry.file_type().ok()?;
            let wanted = if want_directories {
                kind.is_dir() && is_recent_run_id(&name)
            } else {
                kind.is_file() && is_raw_save_name(&name)
            };
            wanted.then_some(name)
        })
        .collect();
    names.sort();
    Ok(names)
}

/// The raw-save folders under `root`, sorted.
pub fn list_raw_save_folders(root: &Path) -> Result<Vec<String>, String> {
    directory_names(root, true)
}

/// The files of one raw-save folder, sorted; a missing folder holds none.
pub fn list_raw_saves(root: &Path, folder: &str) -> Result<Vec<String>, String> {
    directory_names(&raw_save_folder(root, folder)?, false)
}

pub fn read_raw_save(root: &Path, folder: &str, name: &str) -> Result<Vec<u8>, String> {
    read_limited(&raw_save_path(root, folder, name)?, MAX_SAVE_BYTES)
}

pub fn write_raw_save(root: &Path, folder: &str, name: &str, bytes: &[u8]) -> Result<(), String> {
    let path = raw_save_path(root, folder, name)?;
    if bytes.len() as u64 > MAX_SAVE_BYTES {
        return Err(format!("{name} is too large."));
    }
    fs::create_dir_all(raw_save_folder(root, folder)?)
        .map_err(|error| format!("Could not create raw-save folder {folder}: {error}"))?;
    atomic_file::write(&path, bytes, "raw save")
}

/// Removes a raw-save folder and its files; one already gone counts as removed.
pub fn delete_raw_save_folder(root: &Path, folder: &str) -> Result<(), String> {
    match fs::remove_dir_all(raw_save_folder(root, folder)?) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!(
            "Could not delete raw-save folder {folder}: {error}"
        )),
    }
}

/// Renames a raw-save folder over `to`, replacing it; a missing `from` only clears `to`.
pub fn move_raw_save_folder(root: &Path, from: &str, to: &str) -> Result<(), String> {
    let source = raw_save_folder(root, from)?;
    let target = raw_save_folder(root, to)?;
    if source == target {
        return Ok(());
    }
    delete_raw_save_folder(root, to)?;
    match fs::rename(&source, &target) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!(
            "Could not move raw-save folder {from} to {to}: {error}"
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::time::Duration;

    static DIRECTORY_SEQUENCE: AtomicU64 = AtomicU64::new(0);

    struct TestFolder(PathBuf);

    impl TestFolder {
        fn new() -> Self {
            let path = std::env::temp_dir().join(format!(
                "run-planner-run-recording-{}-{}",
                std::process::id(),
                DIRECTORY_SEQUENCE.fetch_add(1, Ordering::Relaxed)
            ));
            fs::create_dir_all(&path).unwrap();
            Self(path)
        }
    }

    impl Drop for TestFolder {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn stamp(len: u64, seconds: u64) -> FileStamp {
        FileStamp {
            len,
            modified: Some(SystemTime::UNIX_EPOCH + Duration::from_secs(seconds)),
        }
    }

    #[test]
    fn builds_the_windows_and_proton_save_folders() {
        assert_eq!(
            windows_save_folder(Path::new("C:/Users/Mel")),
            PathBuf::from("C:/Users/Mel/Saved Games/Hades II")
        );
        assert_eq!(
            proton_save_folder(Path::new("/home/mel/.local/share/Steam")),
            PathBuf::from(
                "/home/mel/.local/share/Steam/steamapps/compatdata/1145350/pfx/drive_c/users/steamuser/Saved Games/Hades II"
            )
        );
    }

    #[test]
    fn orders_linux_steam_roots_and_ignores_a_relative_xdg_data_home() {
        let home = Path::new("/home/mel");
        assert_eq!(
            linux_steam_roots(Some(Path::new("/data")), Some(home)),
            vec![
                PathBuf::from("/data/Steam"),
                PathBuf::from("/home/mel/.steam/steam"),
                PathBuf::from("/home/mel/.steam/root"),
                PathBuf::from("/home/mel/.var/app/com.valvesoftware.Steam/.local/share/Steam"),
            ]
        );
        assert_eq!(
            linux_steam_roots(Some(Path::new("relative")), Some(home))[0],
            PathBuf::from("/home/mel/.local/share/Steam")
        );
        assert!(linux_steam_roots(None, None).is_empty());
    }

    #[test]
    fn reads_library_paths_from_libraryfolders_vdf() {
        let vdf = "\"libraryfolders\"\n{\n\t\"0\"\n\t{\n\t\t\"path\"\t\t\"/home/mel/.local/share/Steam\"\n\t\t\"label\"\t\t\"\"\n\t}\n\t\"1\"\n\t{\n\t\t\"path\"\t\t\"/mnt/games/SteamLibrary\"\n\t\t\"apps\"\n\t\t{\n\t\t\t\"1145350\"\t\t\"123\"\n\t\t}\n\t}\n}\n";
        assert_eq!(
            library_folders_from_vdf(vdf),
            vec![
                PathBuf::from("/home/mel/.local/share/Steam"),
                PathBuf::from("/mnt/games/SteamLibrary"),
            ]
        );
    }

    #[test]
    fn adds_each_steam_library_once_and_finds_the_existing_folder() {
        let folder = TestFolder::new();
        let root = folder.0.join("Steam");
        let other = folder.0.join("Library");
        fs::create_dir_all(root.join("steamapps")).unwrap();
        fs::write(
            root.join("steamapps/libraryfolders.vdf"),
            format!(
                "\"0\" {{ \"path\" \"{}\" }}\n\"1\" {{ \"path\" \"{}\" }}\n",
                root.display(),
                other.display()
            ),
        )
        .unwrap();
        let candidates = proton_save_candidates(std::slice::from_ref(&root));
        assert_eq!(
            candidates,
            vec![proton_save_folder(&root), proton_save_folder(&other)]
        );
        assert_eq!(discover_save_folder(&candidates), None);
        fs::create_dir_all(proton_save_folder(&other)).unwrap();
        assert_eq!(
            discover_save_folder(&candidates),
            Some(proton_save_folder(&other))
        );
    }

    #[test]
    fn recognizes_only_profile_and_checkpoint_saves() {
        for name in ["Profile1.sav", "Profile1_Temp.sav", "Profile12_Temp.sav"] {
            assert!(is_recorded_save(name), "{name}");
        }
        for name in [
            "Profile1.sav.bak",
            "Profile1.sav.bak3",
            "Profile1_Temp.sav.bak",
            "Profile1.v.sav",
            "Profile14328.tmp",
            "Profile.sav",
            "Profile1.sjson",
            "Profile_Temp.sav",
            "../Profile1.sav",
        ] {
            assert!(!is_recorded_save(name), "{name}");
        }
    }

    #[test]
    fn reports_new_and_changed_saves_oldest_first() {
        let mut watch = SaveFolderWatch::default();
        assert_eq!(
            watch.changes(vec![
                ("Profile1_Temp.sav".to_owned(), stamp(10, 20)),
                ("Profile1.sav".to_owned(), stamp(10, 10)),
            ]),
            vec!["Profile1.sav", "Profile1_Temp.sav"]
        );
        assert!(watch
            .changes(vec![
                ("Profile1_Temp.sav".to_owned(), stamp(10, 20)),
                ("Profile1.sav".to_owned(), stamp(10, 10)),
            ])
            .is_empty());
        // A rewrite within the timestamp resolution still changes the size.
        assert_eq!(
            watch.changes(vec![
                ("Profile1_Temp.sav".to_owned(), stamp(11, 20)),
                ("Profile1.sav".to_owned(), stamp(10, 10)),
            ]),
            vec!["Profile1_Temp.sav"]
        );
        assert!(watch
            .changes(vec![("Profile1.sav".to_owned(), stamp(10, 10))])
            .is_empty());
        assert_eq!(
            watch.changes(vec![
                ("Profile1.sav".to_owned(), stamp(10, 10)),
                ("Profile1_Temp.sav".to_owned(), stamp(11, 20)),
            ]),
            vec!["Profile1_Temp.sav"]
        );
    }

    #[test]
    fn reports_a_forgotten_save_again() {
        let mut watch = SaveFolderWatch::default();
        let listing = || vec![("Profile1_Temp.sav".to_owned(), stamp(10, 20))];
        assert_eq!(watch.changes(listing()), vec!["Profile1_Temp.sav"]);
        watch.forget("Profile1_Temp.sav");
        assert_eq!(watch.changes(listing()), vec!["Profile1_Temp.sav"]);
        assert!(watch.changes(listing()).is_empty());
    }

    #[cfg(unix)]
    #[test]
    fn retries_a_save_that_could_not_be_read() {
        use std::os::unix::fs::PermissionsExt;
        let folder = TestFolder::new();
        let path = folder.0.join("Profile1_Temp.sav");
        fs::write(&path, b"SGB1").unwrap();
        fs::set_permissions(&path, fs::Permissions::from_mode(0o000)).unwrap();
        let mut watch = SaveFolderWatch::default();
        // Privileged test runs read the file anyway; the retry is then moot.
        if fs::read(&path).is_ok() {
            return;
        }
        assert!(watch.read_changes(&folder.0).unwrap().is_empty());
        fs::set_permissions(&path, fs::Permissions::from_mode(0o644)).unwrap();
        assert_eq!(
            watch.read_changes(&folder.0).unwrap(),
            vec![("Profile1_Temp.sav".to_owned(), b"SGB1".to_vec())]
        );
    }

    #[test]
    fn polls_a_folder_for_its_recorded_saves() {
        let folder = TestFolder::new();
        let mut watch = SaveFolderWatch::default();
        fs::write(folder.0.join("Profile1_Temp.sav"), b"SGB1").unwrap();
        fs::write(folder.0.join("Profile1_Temp.sav.bak"), b"SGB1").unwrap();
        fs::write(folder.0.join("Profile1.v.sav"), b"SGB1").unwrap();
        assert_eq!(watch.poll(&folder.0).unwrap(), vec!["Profile1_Temp.sav"]);
        assert!(watch.poll(&folder.0).unwrap().is_empty());
        fs::write(folder.0.join("Profile1_Temp.sav"), b"SGB1 longer").unwrap();
        assert_eq!(watch.poll(&folder.0).unwrap(), vec!["Profile1_Temp.sav"]);
        assert_eq!(
            read_save(&folder.0, "Profile1_Temp.sav").unwrap(),
            b"SGB1 longer"
        );
        assert!(read_save(&folder.0, "Profile1_Temp.sav.bak").is_err());
    }

    #[test]
    fn frames_a_save_with_its_name() {
        assert_eq!(
            frame_save("Profile1.sav", b"SGB1"),
            [&[12u8, 0][..], b"Profile1.sav", b"SGB1"].concat()
        );
    }

    #[test]
    fn stores_lists_and_deletes_recent_runs() {
        let folder = TestFolder::new();
        let store = folder.0.join("recent-runs");
        assert!(list_recent_runs(&store).unwrap().is_empty());
        write_recent_run(&store, "run-1003-1793060000", "{\"a\":1}").unwrap();
        write_recent_run(&store, "run-1002-1793057328", "{\"b\":2}").unwrap();
        fs::write(store.join("notes.txt"), "x").unwrap();
        assert_eq!(
            list_recent_runs(&store).unwrap(),
            vec!["run-1002-1793057328", "run-1003-1793060000"]
        );
        assert_eq!(
            read_recent_run(&store, "run-1003-1793060000").unwrap(),
            "{\"a\":1}"
        );
        delete_recent_run(&store, "run-1003-1793060000").unwrap();
        delete_recent_run(&store, "run-1003-1793060000").unwrap();
        assert_eq!(
            list_recent_runs(&store).unwrap(),
            vec!["run-1002-1793057328"]
        );
        assert!(write_recent_run(&store, "../escape", "{}").is_err());
        assert!(read_recent_run(&store, "a/b").is_err());
    }
    #[test]
    fn stores_lists_moves_and_deletes_raw_saves() {
        let folder = TestFolder::new();
        let root = folder.0.join("recent-runs").join("raw");
        assert!(list_raw_save_folders(&root).unwrap().is_empty());
        assert!(list_raw_saves(&root, "open-p1").unwrap().is_empty());
        write_raw_save(&root, "open-p1", "001-Profile1_Temp.sav", b"SGB1 b").unwrap();
        write_raw_save(&root, "open-p1", "000-Profile1_Temp.sav", b"SGB1 a").unwrap();
        fs::write(root.join("open-p1").join("notes"), "x").unwrap();
        fs::write(root.join("stray.json"), "{}").unwrap();
        assert_eq!(list_raw_save_folders(&root).unwrap(), vec!["open-p1"]);
        assert_eq!(
            list_raw_saves(&root, "open-p1").unwrap(),
            vec!["000-Profile1_Temp.sav", "001-Profile1_Temp.sav", "notes"]
        );
        assert_eq!(
            read_raw_save(&root, "open-p1", "000-Profile1_Temp.sav").unwrap(),
            b"SGB1 a"
        );

        // Moving replaces an earlier folder of the same id.
        write_raw_save(&root, "p1-100-1002", "000-old.sav", b"old").unwrap();
        move_raw_save_folder(&root, "open-p1", "p1-100-1002").unwrap();
        assert_eq!(list_raw_save_folders(&root).unwrap(), vec!["p1-100-1002"]);
        assert_eq!(
            read_raw_save(&root, "p1-100-1002", "001-Profile1_Temp.sav").unwrap(),
            b"SGB1 b"
        );
        assert!(read_raw_save(&root, "p1-100-1002", "000-old.sav").is_err());
        // A missing source leaves nothing behind.
        move_raw_save_folder(&root, "open-p2", "p2-1-1").unwrap();
        assert_eq!(list_raw_save_folders(&root).unwrap(), vec!["p1-100-1002"]);

        delete_raw_save_folder(&root, "p1-100-1002").unwrap();
        delete_raw_save_folder(&root, "p1-100-1002").unwrap();
        assert!(list_raw_save_folders(&root).unwrap().is_empty());
    }

    #[test]
    fn refuses_raw_save_paths_outside_their_folder() {
        let folder = TestFolder::new();
        let root = folder.0.join("raw");
        for name in ["../escape.sav", "a/b.sav", ".hidden", "", "a\\b"] {
            assert!(
                write_raw_save(&root, "open-p1", name, b"x").is_err(),
                "{name}"
            );
        }
        for id in ["..", "a/b", "", "a.b"] {
            assert!(
                write_raw_save(&root, id, "000-Profile1.sav", b"x").is_err(),
                "{id}"
            );
            assert!(delete_raw_save_folder(&root, id).is_err(), "{id}");
            assert!(move_raw_save_folder(&root, "open-p1", id).is_err(), "{id}");
        }
        assert!(!folder.0.join("escape.sav").exists());
    }
}

use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

static TEMP_FILE_SEQUENCE: AtomicU64 = AtomicU64::new(0);

fn temporary_path(destination: &Path) -> Result<PathBuf, String> {
    let parent = destination
        .parent()
        .ok_or_else(|| "atomic destination has no parent directory".to_owned())?;
    let file_name = destination
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "atomic destination has no UTF-8 file name".to_owned())?;
    let sequence = TEMP_FILE_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    Ok(parent.join(format!(
        ".{file_name}.{}.{}.tmp",
        std::process::id(),
        sequence
    )))
}

/// A complete temporary file beside its destination, removed unless committed.
pub struct StagedFile {
    temporary: PathBuf,
    destination: PathBuf,
    artifact: String,
    committed: bool,
}

impl StagedFile {
    /// The staged bytes, readable before they replace the destination.
    pub fn path(&self) -> &Path {
        &self.temporary
    }

    /// Atomically replaces the destination with the staged bytes.
    pub fn commit(mut self) -> Result<(), String> {
        replace_file(&self.temporary, &self.destination, &self.artifact)?;
        self.committed = true;
        Ok(())
    }
}

impl Drop for StagedFile {
    fn drop(&mut self) {
        if !self.committed {
            let _ = fs::remove_file(&self.temporary);
        }
    }
}

fn staged(destination: &Path, artifact: &str) -> Result<StagedFile, String> {
    Ok(StagedFile {
        temporary: temporary_path(destination)?,
        destination: destination.to_owned(),
        artifact: artifact.to_owned(),
        committed: false,
    })
}

/// Writes and flushes `bytes` to a temporary file that `commit` moves over `destination`.
pub fn stage(destination: &Path, bytes: &[u8], artifact: &str) -> Result<StagedFile, String> {
    let staged = staged(destination, artifact)?;
    let mut file = OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(&staged.temporary)
        .map_err(|error| format!("could not create temporary {artifact}: {error}"))?;
    file.write_all(bytes)
        .map_err(|error| format!("could not write temporary {artifact}: {error}"))?;
    file.sync_all()
        .map_err(|error| format!("could not flush temporary {artifact}: {error}"))?;
    Ok(staged)
}

/// Stages a copy of `destination` as it is now, so committing it restores those bytes.
pub fn stage_copy(destination: &Path, artifact: &str) -> Result<StagedFile, String> {
    let staged = staged(destination, artifact)?;
    fs::copy(destination, &staged.temporary)
        .map_err(|error| format!("could not copy {artifact}: {error}"))?;
    Ok(staged)
}

pub fn write(destination: &Path, bytes: &[u8], artifact: &str) -> Result<(), String> {
    stage(destination, bytes, artifact)?.commit()
}

#[cfg(target_os = "windows")]
fn replace_file(temporary: &Path, destination: &Path, artifact: &str) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{
        MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
    };
    let source: Vec<u16> = temporary.as_os_str().encode_wide().chain(Some(0)).collect();
    let target: Vec<u16> = destination
        .as_os_str()
        .encode_wide()
        .chain(Some(0))
        .collect();
    let moved = unsafe {
        MoveFileExW(
            source.as_ptr(),
            target.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };
    if moved == 0 {
        return Err(format!(
            "could not replace {artifact}: {}",
            std::io::Error::last_os_error()
        ));
    }
    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn replace_file(temporary: &Path, destination: &Path, artifact: &str) -> Result<(), String> {
    fs::rename(temporary, destination)
        .map_err(|error| format!("could not replace {artifact}: {error}"))
}

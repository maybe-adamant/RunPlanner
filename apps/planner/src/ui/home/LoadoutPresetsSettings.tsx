import { useState } from 'react';

import type { Catalog } from '@run-planner/engine/catalog-schema';
import {
  presetName,
  type ArcanaPreset,
  type LoadoutPresetKind,
  type VowPreset,
} from '@planner/persistence/loadoutPresets';
import {
  describeArcanaPreset,
  describeVowPreset,
  nextPresetName,
  presetFearRanks,
  projectPresetLoadoutEditor,
} from '@planner/projections/loadoutPresets';
import {
  ArcanaBoard,
  ArcanaDialogTitle,
  FearBoard,
  FearDialogTitle,
} from '../controls/arcana-fear/ArcanaFearBoards';
import { EditorDialog, EditorDialogDraftActions } from '../controls/EditorDialog';
import { IconActionButton } from '../controls/IconActionButton';
import { useLoadoutPresets } from '../shell/loadoutPresetsContext';
import { FolderNameDialog } from './LibraryDialogs';
import { HomeToast } from './HomeToast';

type Editing =
  | { readonly kind: 'arcana'; readonly preset: ArcanaPreset | null }
  | { readonly kind: 'vows'; readonly preset: VowPreset | null };

type Deleted =
  | { readonly kind: 'arcana'; readonly preset: ArcanaPreset }
  | { readonly kind: 'vows'; readonly preset: VowPreset };

/**
 * Edits one preset on a loadout of its own through the same board a plan's loadout uses: an
 * Arcana preset with no Vows, a Vow preset with no Arcana.
 */
function PresetEditorDialog({
  catalog,
  editing,
  newName,
  onCancel,
  onSave,
}: {
  readonly catalog: Catalog;
  readonly editing: Editing;
  /** The name a new preset starts with. */
  readonly newName: string;
  readonly onCancel: () => void;
  readonly onSave: (name: string, loadout: PresetLoadout) => void;
}) {
  const [name, setName] = useState(editing.preset?.name ?? newName);
  const [loadout, setLoadout] = useState<PresetLoadout>(() => ({
    manualArcanaKeys: editing.kind === 'arcana' ? (editing.preset?.cardKeys ?? []) : [],
    fearRanks: presetFearRanks(
      catalog,
      editing.kind === 'vows' ? (editing.preset?.ranks ?? {}) : {},
    ),
  }));
  const editor = projectPresetLoadoutEditor(catalog, loadout);
  const title = `${editing.preset === null ? 'New' : 'Edit'} ${editing.kind === 'arcana' ? 'Arcana' : 'Vow'} preset`;
  return (
    <EditorDialog
      eyebrow="Presets"
      footer={
        <EditorDialogDraftActions
          onCancel={onCancel}
          onSave={() => onSave(name, loadout)}
          saveDisabled={presetName(name) === ''}
        />
      }
      model={{ kind: 'draft', onCancel }}
      size="cards"
      title={
        editing.kind === 'arcana' ? (
          <ArcanaDialogTitle derived={editor.derived} title={title} />
        ) : (
          <FearDialogTitle
            catalog={catalog}
            derived={editor.derived}
            fearRanks={loadout.fearRanks}
            title={title}
          />
        )
      }
    >
      <label className="library-dialog-field preset-name-field">
        Preset name
        <input
          autoComplete="off"
          onChange={(event) => setName(event.target.value)}
          spellCheck={false}
          type="text"
          value={name}
        />
      </label>
      {editing.kind === 'arcana' ? (
        <ArcanaBoard
          catalog={catalog}
          derived={editor.derived}
          domain={editor.domain}
          onReplace={(manualArcanaKeys) => setLoadout({ ...loadout, manualArcanaKeys })}
        />
      ) : (
        <FearBoard
          catalog={catalog}
          derived={editor.derived}
          domain={editor.domain}
          onRank={(vowKey, rank) =>
            setLoadout({ ...loadout, fearRanks: { ...loadout.fearRanks, [vowKey]: rank } })
          }
        />
      )}
    </EditorDialog>
  );
}

type PresetLoadout = {
  readonly manualArcanaKeys: readonly string[];
  readonly fearRanks: Readonly<Record<string, number>>;
};

function PresetList({
  kind,
  onAdd,
  onDelete,
  onEdit,
  onRename,
  rows,
  title,
}: {
  readonly kind: LoadoutPresetKind;
  readonly onAdd: () => void;
  readonly onDelete: (id: string) => void;
  readonly onEdit: (id: string) => void;
  readonly onRename: (id: string, name: string) => void;
  readonly rows: readonly {
    readonly id: string;
    readonly name: string;
    readonly summary: string;
  }[];
  readonly title: string;
}) {
  return (
    <div className="preset-list">
      <div className="preset-list-head">
        <h4 className="home-section-title" id={`presets-${kind}-title`}>
          {title}
        </h4>
        <button className="quiet-action action-compact" onClick={onAdd} type="button">
          Add preset
        </button>
      </div>
      {rows.length === 0 ? (
        <p className="home-setting-hint">No presets yet.</p>
      ) : (
        <ul aria-labelledby={`presets-${kind}-title`} className="preset-rows">
          {rows.map((row) => (
            <li key={row.id}>
              <div className="preset-row-text">
                <span className="preset-row-name">{row.name}</span>
                <span className="home-setting-hint">{row.summary}</span>
              </div>
              <div className="library-row-actions">
                <IconActionButton
                  hint="Edit"
                  icon="edit"
                  label={`Edit ${row.name}`}
                  onClick={() => onEdit(row.id)}
                />
                <IconActionButton
                  hint="Rename"
                  icon="rename"
                  label={`Rename ${row.name}`}
                  onClick={() => onRename(row.id, row.name)}
                />
                <IconActionButton
                  hint="Delete"
                  icon="trash"
                  label={`Delete ${row.name}`}
                  onClick={() => onDelete(row.id)}
                  tone="danger"
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Settings' Presets: the planner's Arcana and Vow presets, which the editor's pickers offer. */
export function LoadoutPresetsSettings({ catalog }: { readonly catalog: Catalog }) {
  const { controller, snapshot } = useLoadoutPresets();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [renaming, setRenaming] = useState<{
    readonly kind: LoadoutPresetKind;
    readonly id: string;
    readonly name: string;
  } | null>(null);
  const [deleted, setDeleted] = useState<
    (Deleted & { readonly index: number; readonly notice: number }) | null
  >(null);
  if (controller === null) return null;
  const remove = (target: Deleted) => {
    const list: readonly { readonly id: string }[] =
      target.kind === 'arcana' ? snapshot.arcana : snapshot.vows;
    const index = list.findIndex((entry) => entry.id === target.preset.id);
    controller.remove(target.kind, target.preset.id);
    setDeleted((previous) => ({ ...target, index, notice: (previous?.notice ?? 0) + 1 }));
  };
  return (
    <section aria-labelledby="settings-presets-title" className="home-panel home-card">
      <h3 className="home-panel-title" id="settings-presets-title">
        Presets
      </h3>
      {snapshot.dropped === 0 ? null : (
        <p className="home-problem" role="status">
          Some presets had unknown cards or Vows; those were removed.
        </p>
      )}
      <PresetList
        kind="arcana"
        onAdd={() => setEditing({ kind: 'arcana', preset: null })}
        onDelete={(id) => {
          const preset = snapshot.arcana.find((entry) => entry.id === id);
          if (preset !== undefined) remove({ kind: 'arcana', preset });
        }}
        onEdit={(id) =>
          setEditing({
            kind: 'arcana',
            preset: snapshot.arcana.find((entry) => entry.id === id) ?? null,
          })
        }
        onRename={(id, name) => setRenaming({ kind: 'arcana', id, name })}
        rows={snapshot.arcana.map((preset) => ({
          id: preset.id,
          name: preset.name,
          summary: describeArcanaPreset(catalog, preset),
        }))}
        title="Arcana"
      />
      <PresetList
        kind="vows"
        onAdd={() => setEditing({ kind: 'vows', preset: null })}
        onDelete={(id) => {
          const preset = snapshot.vows.find((entry) => entry.id === id);
          if (preset !== undefined) remove({ kind: 'vows', preset });
        }}
        onEdit={(id) =>
          setEditing({
            kind: 'vows',
            preset: snapshot.vows.find((entry) => entry.id === id) ?? null,
          })
        }
        onRename={(id, name) => setRenaming({ kind: 'vows', id, name })}
        rows={snapshot.vows.map((preset) => ({
          id: preset.id,
          name: preset.name,
          summary: describeVowPreset(catalog, preset),
        }))}
        title="Vows"
      />
      {editing === null ? null : (
        <PresetEditorDialog
          catalog={catalog}
          editing={editing}
          newName={nextPresetName(
            editing.kind,
            editing.kind === 'arcana' ? snapshot.arcana : snapshot.vows,
          )}
          onCancel={() => setEditing(null)}
          onSave={(name, loadout) => {
            const id = editing.preset === null ? {} : { id: editing.preset.id };
            if (editing.kind === 'arcana')
              controller.saveArcana({ ...id, name, cardKeys: loadout.manualArcanaKeys });
            else controller.saveVows({ ...id, name, ranks: loadout.fearRanks });
            setEditing(null);
          }}
        />
      )}
      {renaming === null ? null : (
        <FolderNameDialog
          fieldLabel="Preset name"
          initial={renaming.name}
          onApply={(name) => {
            if (presetName(name) === '') return Promise.resolve('Name the preset.');
            controller.rename(renaming.kind, renaming.id, name);
            setRenaming(null);
            return Promise.resolve(null);
          }}
          onCancel={() => setRenaming(null)}
          title="Rename preset"
        />
      )}
      {deleted === null ? null : (
        <HomeToast
          action={{
            label: 'Undo',
            run: () => {
              controller.restore(deleted, deleted.index);
              setDeleted(null);
            },
          }}
          key={deleted.notice}
          onDismiss={() => setDeleted(null)}
          text={`Deleted preset “${deleted.preset.name}”`}
        />
      )}
    </section>
  );
}

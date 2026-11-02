import { useState } from 'react';
import {
  planFearRanksReplacement,
  planManualArcanaReplacement,
  type RouteLoadout,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';

import type { ArcanaPreset, VowPreset } from '@planner/persistence/loadoutPresets';
import {
  presetFearRanks,
  projectArcanaPresetChips,
  projectPresetLoadoutEditor,
  projectVowPresetChips,
} from '@planner/projections/loadoutPresets';
import { authoredProjectCommandsDispatched } from '@planner/state/projectWorkspaceSlice';
import { useAppDispatch } from '@planner/state/store';
import {
  ArcanaBoard,
  ArcanaDialogTitle,
  FearBoard,
  FearBoardHelp,
  FearDialogTitle,
} from '@planner/ui/controls/arcana-fear/ArcanaFearBoards';
import { PresetChips } from '@planner/ui/controls/arcana-fear/PresetChips';
import { EditorDialog, EditorDialogDraftActions } from '@planner/ui/controls/EditorDialog';
import { draftValueIdentity } from '@planner/ui/controls/draftValueIdentity';

type ArcanaFearLoadout = Pick<RouteLoadout, 'manualArcanaKeys' | 'fearRanks'>;

/**
 * The plan's starting Arcana or Fear as one draft over its own loadout: the board and presets
 * edit the draft, and Save replaces the saved selection in one edit.
 */
export function LoadoutBoardDialog({
  board,
  catalog,
  loadout,
  onClose,
  presets,
  rarityOf,
  returnFocusId,
  routeKey,
}: {
  readonly board: 'arcana' | 'fear';
  readonly catalog: Catalog;
  /** The saved loadout. */
  readonly loadout: ArcanaFearLoadout;
  readonly onClose: () => void;
  readonly presets: {
    readonly arcana: readonly ArcanaPreset[];
    readonly vows: readonly VowPreset[];
  };
  readonly rarityOf?: (cardKey: string) => string | undefined;
  readonly returnFocusId: string;
  readonly routeKey: string;
}) {
  const dispatch = useAppDispatch();
  const saved: ArcanaFearLoadout = {
    manualArcanaKeys: loadout.manualArcanaKeys,
    fearRanks: loadout.fearRanks,
  };
  // A changed saved loadout replaces the draft.
  const savedIdentity = draftValueIdentity(saved);
  const [draftState, setDraftState] = useState(() => ({ identity: savedIdentity, loadout: saved }));
  const draft = draftState.identity === savedIdentity ? draftState.loadout : saved;
  const setDraft = (next: ArcanaFearLoadout): void =>
    setDraftState({ identity: savedIdentity, loadout: next });
  const editor = projectPresetLoadoutEditor(catalog, draft);
  const replacement =
    board === 'arcana'
      ? planManualArcanaReplacement(catalog, routeKey, saved, draft.manualArcanaKeys)
      : planFearRanksReplacement(catalog, routeKey, saved, draft.fearRanks);
  // Only a preserved over-capacity loadout can leave a draft the commands refuse.
  const issues =
    replacement.kind === 'refused'
      ? [
          [
            'grasp',
            board === 'arcana'
              ? `Needs ${replacement.grasp.cost} Grasp; your Vows allow ${replacement.grasp.capacity}.`
              : `Your Arcana need ${replacement.grasp.cost} Grasp; these Vows allow ${replacement.grasp.capacity}.`,
          ] as const,
        ]
      : [];
  return (
    <EditorDialog
      layout="header"
      model={{ kind: 'draft', onCancel: onClose }}
      returnFocusId={returnFocusId}
      size="cards"
      title={
        board === 'arcana' ? (
          <ArcanaDialogTitle derived={editor.derived} title="Arcana" />
        ) : (
          <FearDialogTitle
            catalog={catalog}
            derived={editor.derived}
            fearRanks={draft.fearRanks}
            title="Fear"
          />
        )
      }
    >
      {board === 'fear' ? <FearBoardHelp /> : null}
      <EditorDialogDraftActions
        issues={issues}
        onCancel={onClose}
        onSave={() => {
          if (replacement.kind === 'apply')
            dispatch(authoredProjectCommandsDispatched(replacement.commands));
          onClose();
        }}
        saveDisabled={replacement.kind !== 'apply'}
      />
      {board === 'arcana' ? (
        <>
          {presets.arcana.length === 0 ? null : (
            <PresetChips
              chips={projectArcanaPresetChips(catalog, routeKey, draft, presets.arcana)}
              label="Arcana presets"
              onApply={(chip) => {
                const preset = presets.arcana.find((entry) => entry.id === chip.id);
                if (preset !== undefined) setDraft({ ...draft, manualArcanaKeys: preset.cardKeys });
              }}
            />
          )}
          <ArcanaBoard
            catalog={catalog}
            derived={editor.derived}
            domain={editor.domain}
            onReplace={(manualArcanaKeys) => setDraft({ ...draft, manualArcanaKeys })}
            {...(rarityOf === undefined ? {} : { rarityOf })}
          />
        </>
      ) : (
        <>
          {presets.vows.length === 0 ? null : (
            <PresetChips
              chips={projectVowPresetChips(catalog, routeKey, draft, presets.vows)}
              label="Vow presets"
              onApply={(chip) => {
                const preset = presets.vows.find((entry) => entry.id === chip.id);
                if (preset !== undefined)
                  setDraft({ ...draft, fearRanks: presetFearRanks(catalog, preset.ranks) });
              }}
            />
          )}
          <FearBoard
            catalog={catalog}
            derived={editor.derived}
            domain={editor.domain}
            onRank={(vowKey, rank) =>
              setDraft({ ...draft, fearRanks: { ...draft.fearRanks, [vowKey]: rank } })
            }
          />
        </>
      )}
    </EditorDialog>
  );
}

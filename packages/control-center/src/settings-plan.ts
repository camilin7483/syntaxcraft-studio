import { isDeepStrictEqual } from 'node:util';
import { compileRules, ruleMechanisms } from '../../colors/src';
import { isRecord, preferenceSettings } from './profile';
import type { Preferences, Profile } from './profile';

const textMateSetting = 'editor.tokenColorCustomizations';
const semanticSetting = 'editor.semanticTokenColorCustomizations';
const workbenchSetting = 'workbench.colorCustomizations';
const managedName = /^SyntaxCraft: \[[\da-f-]{36}:\d+\] /i;

export const managedSettings = [
  ...Object.values(preferenceSettings),
  textMateSetting,
  semanticSetting,
  workbenchSetting,
] as const;
export type SettingKey = (typeof managedSettings)[number];
export type SettingValues = Partial<Record<SettingKey, unknown>>;

export interface SettingChange {
  key: SettingKey;
  before?: unknown;
  after?: unknown;
}

function configurableObject(value: unknown, key: string): Record<string, unknown> {
  if (value === undefined) return {};
  if (!isRecord(value)) throw new Error(`Revisa el valor de ${key} en los ajustes de VS Code.`);
  return value;
}

function changed(current: SettingValues, next: SettingValues): SettingChange[] {
  return managedSettings.flatMap((key) => {
    const before = current[key];
    const after = next[key];
    return isDeepStrictEqual(before, after) ? [] : [{ key, before, after }];
  });
}

function customRules(
  profile: Profile,
  baseline: SettingValues,
  user: SettingValues,
  nonce: string,
): SettingValues {
  const compiled = compileRules(profile.rules);
  const next = { ...baseline };
  if (compiled.textMateRules.length > 0) {
    const target = configurableObject(baseline[textMateSetting], textMateSetting);
    const inherited = isRecord(user[textMateSetting])
      ? user[textMateSetting].textMateRules
      : undefined;
    const existing = target.textMateRules ?? inherited ?? [];
    if (!Array.isArray(existing))
      throw new Error(`Revisa el valor de ${textMateSetting}.textMateRules.`);
    next[textMateSetting] = {
      ...target,
      textMateRules: [
        ...existing,
        ...compiled.textMateRules.map((rule, i) => ({
          ...rule,
          name: `SyntaxCraft: [${nonce}:${i}] ${rule.name.replace(/^SyntaxCraft:\s*/, '')}`,
        })),
      ],
    };
  }
  if (Object.keys(compiled.semanticRules).length > 0) {
    const target = configurableObject(baseline[semanticSetting], semanticSetting);
    const currentRules = configurableObject(target.rules, `${semanticSetting}.rules`);
    const userSetting = user[semanticSetting];
    const userRules = isRecord(userSetting) && isRecord(userSetting.rules) ? userSetting.rules : {};
    const rules = new Map(Object.entries(currentRules));
    for (const [selector, style] of Object.entries(compiled.semanticRules)) {
      const previous = rules.get(selector) ?? userRules[selector];
      const fields =
        typeof previous === 'string'
          ? { foreground: previous }
          : isRecord(previous)
            ? previous
            : {};
      rules.set(selector, { ...fields, ...style });
    }
    next[semanticSetting] = { ...target, rules: Object.fromEntries(rules) };
  }
  if (Object.keys(profile.workbench).length > 0) {
    next[workbenchSetting] = {
      ...configurableObject(baseline[workbenchSetting], workbenchSetting),
      ...profile.workbench,
    };
  }
  return next;
}

function ownedRule(value: unknown): string | undefined {
  return isRecord(value) && typeof value.name === 'string' && managedName.test(value.name)
    ? value.name
    : undefined;
}

function listOfRules(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function restoreTextMateList(
  current: unknown[],
  before: unknown,
  after: unknown,
  markConflict: () => void,
): unknown[] {
  const oldRules = new Map(listOfRules(before).map((rule) => [ownedRule(rule), rule] as const));
  const writtenRules = new Map(listOfRules(after).map((rule) => [ownedRule(rule), rule] as const));
  const seen = new Set<string>();
  const result = current.flatMap((rule) => {
    const name = ownedRule(rule);
    if (!name) return [rule];
    seen.add(name);
    if (!writtenRules.has(name) || isDeepStrictEqual(oldRules.get(name), writtenRules.get(name)))
      return [rule];
    if (!isDeepStrictEqual(rule, writtenRules.get(name))) {
      markConflict();
      return [rule];
    }
    return oldRules.has(name) ? [oldRules.get(name)] : [];
  });
  for (const [name, rule] of oldRules) {
    if (name && !writtenRules.has(name) && !seen.has(name)) result.push(rule);
  }
  if (before === undefined && result.length !== 0) markConflict();
  return result;
}

function revertValue(
  current: unknown,
  before: unknown,
  after: unknown,
  markConflict: () => void,
  textMateList = false,
): unknown {
  if (isDeepStrictEqual(before, after)) return current;
  if (isDeepStrictEqual(current, after)) return before;
  if (isDeepStrictEqual(current, before)) return current;
  if (textMateList && Array.isArray(current)) {
    return restoreTextMateList(current, before, after, markConflict);
  }
  if (
    isRecord(current) &&
    (before === undefined || isRecord(before)) &&
    (after === undefined || isRecord(after))
  ) {
    const result = new Map(Object.entries(current));
    const paths = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
    for (const key of paths) {
      const oldValue = before && Object.hasOwn(before, key) ? before[key] : undefined;
      const writtenValue = after && Object.hasOwn(after, key) ? after[key] : undefined;
      const restored = revertValue(
        result.get(key),
        oldValue,
        writtenValue,
        markConflict,
        key === 'textMateRules',
      );
      if (restored === undefined) result.delete(key);
      else result.set(key, restored);
    }
    return result.size > 0 || before !== undefined ? Object.fromEntries(result) : undefined;
  }
  markConflict();
  return current;
}

/** A three-way revert updates Studio-owned values while retaining edits made through VS Code. */
export function revertSettings(current: SettingValues, changes: readonly SettingChange[]) {
  const values = { ...current };
  const conflicts = new Set<SettingKey>();
  for (const { key, before, after } of changes) {
    const restored = revertValue(values[key], before, after, () => conflicts.add(key));
    if (restored === undefined) delete values[key];
    else values[key] = restored;
  }
  return { values, conflicts: [...conflicts] };
}

export function prepareApplication(
  current: SettingValues,
  user: SettingValues,
  previousOverlay: readonly SettingChange[],
  profile: Profile | undefined,
  nonce: string,
) {
  const { values: baseline, conflicts } = revertSettings(current, previousOverlay);
  const next = profile ? customRules(profile, baseline, user, nonce) : baseline;
  if (profile) {
    for (const preference of Object.keys(preferenceSettings) as (keyof Preferences)[]) {
      const value = profile.preferences[preference];
      if (value !== undefined)
        next[preferenceSettings[preference]] =
          value === 'none' && preference === 'fileIcons' ? null : value;
    }
  }

  const unavailable =
    profile?.rules.filter((rule) => {
      const possible = ruleMechanisms(rule.token, rule.language);
      return rule.mechanism && rule.mechanism !== 'auto'
        ? !possible.includes(rule.mechanism)
        : possible.length === 0;
    }).length ?? 0;
  return {
    changes: changed(current, next),
    overlay: changed(baseline, next),
    conflicts,
    unavailable,
  };
}

export function prepareUndo(current: SettingValues, changes: readonly SettingChange[]) {
  const { values, conflicts } = revertSettings(current, changes);
  return { changes: changed(current, values), conflicts };
}

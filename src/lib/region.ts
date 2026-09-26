import {
  REGION_PRESETS,
  detectPreset,
  findPreset,
  type DateFormat,
  type RegionPreset,
  type WeekStart,
} from '@/config/regions'
import type { Settings } from '@/types'

/** Everything that decides how amounts, dates and "today" work for a user. */
export interface Region {
  country: string
  currency: string
  locale: string
  timeZone: string
  dateFormat: DateFormat
  weekStartsOn: WeekStart
  chequeValidityMonths: number
  clearingDays: number
}

export function regionFromPreset(preset: RegionPreset, timeZone = preset.timeZone): Region {
  return {
    country: preset.country,
    currency: preset.currency,
    locale: preset.locale,
    timeZone,
    dateFormat: preset.dateFormat,
    weekStartsOn: preset.weekStartsOn,
    chequeValidityMonths: preset.chequeValidityMonths,
    clearingDays: preset.clearingDays,
  }
}

/** A best guess from the browser, used only until the user's settings load. */
function browserRegion(): Region {
  const detected = detectPreset()
  return detected
    ? regionFromPreset(detected.preset, detected.timeZone)
    : regionFromPreset(REGION_PRESETS[0])
}

/**
 * The user's region from their settings, filling any empty column from their
 * country's preset. Null until they have picked a country.
 */
export function regionFromSettings(settings: Settings): Region | null {
  if (!settings.country_code) return null
  const preset = findPreset(settings.country_code)
  const base = preset ? regionFromPreset(preset) : browserRegion()
  return {
    country: settings.country_code,
    currency: settings.currency_code ?? base.currency,
    locale: settings.locale ?? base.locale,
    timeZone: settings.timezone ?? base.timeZone,
    dateFormat: settings.date_format ?? base.dateFormat,
    weekStartsOn: settings.week_starts_on ?? base.weekStartsOn,
    chequeValidityMonths: settings.cheque_validity_months ?? base.chequeValidityMonths,
    clearingDays: settings.clearing_days ?? base.clearingDays,
  }
}

/** Settings columns for a region. `currency_symbol` is kept up to date for older clients. */
export function regionToSettings(region: Region) {
  return {
    country_code: region.country,
    currency_code: region.currency,
    locale: region.locale,
    timezone: region.timeZone,
    date_format: region.dateFormat,
    week_starts_on: region.weekStartsOn,
    cheque_validity_months: region.chequeValidityMonths,
    clearing_days: region.clearingDays,
    currency_symbol: currencySymbolFor(region),
  }
}

function currencySymbolFor(region: Region): string {
  try {
    const part = new Intl.NumberFormat(region.locale, { style: 'currency', currency: region.currency })
      .formatToParts(0)
      .find((p) => p.type === 'currency')
    return part?.value ?? region.currency
  } catch {
    return region.currency
  }
}

/** Changes whenever anything in the region changes. */
export function regionKey(region: Region): string {
  return [
    region.country,
    region.currency,
    region.locale,
    region.timeZone,
    region.dateFormat,
    region.weekStartsOn,
    region.chequeValidityMonths,
    region.clearingDays,
  ].join('|')
}

let active: Region = browserRegion()

/** The signed-in user's region. The formatters in formatters.ts read it. */
export function getActiveRegion(): Region {
  return active
}

/** Called by SettingsProvider whenever the user's settings load or change. */
export function setActiveRegion(region: Region) {
  active = region
}

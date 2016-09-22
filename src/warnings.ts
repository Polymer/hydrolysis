/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */

import * as chalk from 'chalk';

import {Analyzer} from './analyzer';
import {Severity, Warning} from './editor-service/editor-service';
import {SourceRange} from './model/source-range';

export enum Verbosity {
  OneLine,
  Full,
}

export interface PrinterOptions {
  analyzer: Analyzer;
  verbosity?: Verbosity;
  color?: boolean;
}

export interface FilterOptions {
  /**
   * Warning codes like 'parse-error' or 'behavior-not-found' to filter out.
   */
  warningCodesToIgnore?: Set<string>;
  /**
   * All warnings below this level of severity will be filtered out.
   */
  minimumSeverity: Severity;
}

const defaultFilterOptions: FilterOptions = {
  warningCodesToIgnore: new Set(),
  minimumSeverity: Severity.INFO
};

export class WarningFilterer {
  constructor(private _options: FilterOptions) {
    this._options = Object.assign({}, defaultFilterOptions, this._options);
  }

  shouldIgnore(warning: Warning) {
    if (this._options.warningCodesToIgnore.has(warning.code)) {
      return true;
    }
    if (warning.severity > this._options.minimumSeverity) {
      return true;
    }
    return false;
  }
}

const defaultPrinterOptions = {
  verbosity: Verbosity.Full,
  color: true
};

export class WarningPrinter {
  _chalk: typeof chalk;

  constructor(
      private _outStream: NodeJS.WritableStream,
      private _options?: PrinterOptions) {
    this._options = Object.assign({}, defaultPrinterOptions, _options);
    // TODO(rictic): remove cast to `any` here once upstream PR has landed:
    //     https://github.com/DefinitelyTyped/DefinitelyTyped/pull/11411
    this._chalk =
        new (chalk.constructor as any)({enabled: this._options.color});
  }

  /**
   * Convenience method around `printWarning`.
   */
  async printWarnings(warnings: Iterable<Warning>) {
    for (const warning of warnings) {
      await this.printWarning(warning);
    }
  }

  async printWarning(warning: Warning) {
    const severity = this._severityToString(warning.severity);
    const range = warning.sourceRange;

    if (this._options.verbosity >= Verbosity.Full) {
      this._outStream.write('\n');
      const lineText = await this._getTextOfLine(range.start.line, range.file);
      this._outStream.write(`${lineText}\n`);
      const colorFunction = this._severityToColorFunction(warning.severity);
      const underlineText = getUnderlineText(lineText, range);
      this._outStream.write(`${colorFunction(underlineText)}\n`);
      this._outStream.write('\n');
    }

    this._outStream.write(
        `${range.file}` +
        `(${range.start.line},${range.start.column}) ` +
        `${severity} [${warning.code}] - ${warning.message}\n`);
  }

  private _severityToString(severity: Severity) {
    const colorFunction = this._severityToColorFunction(severity);
    switch (severity) {
      case Severity.ERROR:
        return colorFunction('error');
      case Severity.WARNING:
        return colorFunction('warning');
      case Severity.INFO:
        return colorFunction('info');
      default:
        const never: never = severity;
        throw new Error(`Unknown severity value - ${never
                        } - encountered while printing warning.`);
    }
  }

  private _severityToColorFunction(severity: Severity) {
    switch (severity) {
      case Severity.ERROR:
        return this._chalk.red;
      case Severity.WARNING:
        return this._chalk.yellow;
      case Severity.INFO:
        return this._chalk.green;
      default:
        const never: never = severity;
        throw new Error(`Unknown severity value - ${never
                        } - encountered while printing warning.`);
    }
  }

  private async _getTextOfLine(line: number, localPath: string) {
    const contents = await this._options.analyzer.load(localPath);
    return contents.split('\n')[line];
  }
}

function getUnderlineText(lineText: string, sourceRange: SourceRange) {
  const startColumn = sourceRange.start.column;
  const endColumn = sourceRange.end.line === sourceRange.start.line ?
      sourceRange.end.column :
      lineText.length;
  let underline = ' '.repeat(startColumn);
  underline += '~';
  if (startColumn === endColumn) {
    return underline;
  }
  underline += '~'.repeat(endColumn - (startColumn + 1));
  return underline;
}
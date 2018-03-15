/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
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

import {Binding, NodePath} from 'babel-traverse';
import * as babel from 'babel-types';

import * as esutil from '../javascript/esutil';
import {Annotation} from '../javascript/jsdoc';

import {Result} from './analysis';
import {Document} from './document';
import {Feature, ScannedFeature} from './feature';
import {FeatureKindMap} from './queryable';
import {Resolvable} from './resolvable';
import {SourceRange} from './source-range';
import {Severity, Warning} from './warning';


/**
 * A reference to another feature by identifier.
 */
export class ScannedReference<K extends keyof FeatureKindMap> extends
    ScannedFeature implements Resolvable {
  readonly identifier: string;
  readonly kind: K;
  readonly sourceRange: SourceRange|undefined;
  readonly astPath: NodePath;
  readonly astNode: babel.Node|undefined;

  constructor(
      kind: K, identifier: string, sourceRange: SourceRange|undefined,
      astNode: babel.Node|undefined, astPath: NodePath, description?: string,
      jsdoc?: Annotation, warnings?: Warning[]) {
    super(sourceRange, astNode, description, jsdoc, warnings);
    this.kind = kind;
    this.astNode = astNode;
    this.astPath = astPath;
    this.sourceRange = sourceRange;
    this.identifier = identifier;
  }

  resolve(document: Document): Reference<FeatureKindMap[K]> {
    return this.resolveWithKind(document, this.kind);
  }

  // Leaving this as a public method, in case we want to use a more
  // specific kind (e.g. resolve a PolymerElement rather than just a Class).
  resolveWithKind<DK extends keyof FeatureKindMap>(
      document: Document, kind: DK): Reference<FeatureKindMap[DK]> {
    let feature: undefined|FeatureKindMap[DK];
    const warnings = [...this.warnings];

    const binding = this.astPath.scope.getBinding(this.identifier);
    if (binding !== undefined) {
      const result = resolveBinding(binding, document, kind);
      if (result.successful) {
        feature = result.value;
      }
    }
    if (feature === undefined) {
      // We didn't find it by doing principled scope-based analysis. Let's try
      // looking it up in our big global map!
      const features = document.getFeatures(
          {imported: true, externalPackages: true, kind, id: this.identifier});
      if (this.sourceRange) {
        if (features.size === 0) {
          let message = `Could not resolve reference to ${this.kind}`;
          if (kind === 'behavior') {
            message += `. Is it annotated with @polymerBehavior?`;
          }
          warnings.push(new Warning({
            code: 'could-not-resolve-reference',
            sourceRange: this.sourceRange,
            message,
            parsedDocument: document.parsedDocument,
            severity: Severity.WARNING
          }));
        } else if (features.size > 1) {
          warnings.push(new Warning({
            code: 'multiple-global-declarations',
            sourceRange: this.sourceRange,
            message: `Multiple global declarations of ${
                this.kind} with identifier ${this.identifier}`,
            parsedDocument: document.parsedDocument,
            severity: Severity.WARNING
          }));
        }
      }
      [feature] = features;
    }
    return new Reference<FeatureKindMap[K]>(this, feature, warnings);
  }
}

function resolveBinding<K extends keyof FeatureKindMap>(
    binding: Binding, document: Document, kind: K):
    Result<FeatureKindMap[K], Warning|undefined> {
  const statement = esutil.getCanonicalStatement(binding.path);
  if (!statement) {
    return {successful: false, error: undefined};
  }
  const features = document.getFeatures({kind, statement});
  if (features.size > 1) {
    // TODO(rictic): narrow down by identifier? warn?
    return {successful: false, error: undefined};
  }
  const [feature] = features;
  if (feature === undefined) {
    return {successful: false, error: undefined};
  }
  return {successful: true, value: feature};
}


declare module './queryable' {
  interface FeatureKindMap {
    'reference': Reference<Feature>;
  }
}

const referenceSet: ReadonlySet<'reference'> =
    new Set<'reference'>(['reference']);
const emptySet: ReadonlySet<string> = new Set();

/**
 * A reference to another feature by identifier.
 */
export class Reference<F extends Feature> implements Feature {
  readonly kinds = referenceSet;
  readonly identifiers = emptySet;
  readonly identifier: string;
  readonly sourceRange: SourceRange|undefined;
  readonly astNode: any;
  readonly feature: F|undefined;
  readonly warnings: ReadonlyArray<Warning>;

  constructor(
      scannedReference: ScannedReference<any>, feature: F|undefined,
      warnings: ReadonlyArray<Warning>) {
    this.identifier = scannedReference.identifier;
    this.sourceRange = scannedReference.sourceRange;
    this.warnings = warnings;
    this.feature = feature;
  }
}

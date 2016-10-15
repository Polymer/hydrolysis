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

import {Resolvable, SourceRange, Feature} from '../model/model';
import {Warning} from '../warning/warning';
import * as dom5 from 'dom5';

export interface Attribute {
  name: string;
  sourceRange: SourceRange;
  nameSourceRange: SourceRange;
  valueSourceRange: SourceRange|undefined;
  value?: string;
}

export class ElementReference implements Feature {
  tagName: string;
  attributes: Attribute[] = [];
  sourceRange: SourceRange;
  astNode: dom5.Node;
  warnings: Warning[] = [];
  kinds: Set<string> = new Set(['element-reference']);

  get identifiers(): Set<string> {
    return new Set([this.tagName]);
  }
}

export class ScannedElementReference implements Resolvable {
  tagName: string;
  attributes: Attribute[] = [];
  sourceRange: SourceRange;
  astNode: dom5.Node;
  warnings: Warning[] = [];

  constructor(
    tagName: string, sourceRange: SourceRange,
    ast: dom5.Node) {
      this.tagName = tagName;
      this.sourceRange = sourceRange;
      this.astNode = ast;
  }

  resolve(): ElementReference {
    const ref = new ElementReference();
    Object.assign(ref, this);
    return ref;
  }
}


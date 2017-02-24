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


import {assert} from 'chai';
import * as path from 'path';

import {Visitor} from '../../javascript/estree-visitor';
import {JavaScriptParser} from '../../javascript/javascript-parser';
import {ScannedFeature} from '../../model/model';
import {ScannedNamespace} from '../../polymer/namespace';
import {NamespaceScanner} from '../../polymer/namespace-scanner';
import {FSUrlLoader} from '../../url-loader/fs-url-loader';
import {CodeUnderliner} from '../test-utils';

suite('NamespaceScanner', () => {
  const testFilesDir = path.resolve(__dirname, '../static/namespaces/');
  const urlLoader = new FSUrlLoader(testFilesDir);
  const underliner = new CodeUnderliner(urlLoader);

  async function getNamespaces(filename: string): Promise<any[]> {
    const file = await urlLoader.load(filename);
    const parser = new JavaScriptParser();
    const document = parser.parse(file, filename);
    const scanner = new NamespaceScanner();
    const visit = (visitor: Visitor) =>
        Promise.resolve(document.visit([visitor]));
    const features: ScannedFeature[] = await scanner.scan(document, visit);
    return <ScannedNamespace[]>features.filter(
        (e) => e instanceof ScannedNamespace);
  };

  test('scans named namespaces', async() => {
    const namespaces = await getNamespaces('namespace-named.js');
    assert.equal(namespaces.length, 2);

    assert.equal(namespaces[0].name, 'ExplicitlyNamedNamespace');
    assert.equal(namespaces[0].description, '\n');
    assert.deepEqual(namespaces[0].warnings, []);
    assert.equal(await underliner.underline(namespaces[0].sourceRange), `
var ExplicitlyNamedNamespace = {};
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~`);

    assert.equal(
        namespaces[1].name, 'ExplicitlyNamedNamespace.NestedNamespace');
    assert.equal(namespaces[1].description, '\n');
    assert.deepEqual(namespaces[1].warnings, []);
    assert.equal(await underliner.underline(namespaces[1].sourceRange), `
ExplicitlyNamedNamespace.NestedNamespace = {
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  foo: \'bar\'
~~~~~~~~~~~~
};
~~`);
  });

  test('scans unnamed namespaces', async() => {
    const namespaces = await getNamespaces('namespace-unnamed.js');
    assert.equal(namespaces.length, 2);

    assert.equal(namespaces[0].name, 'ImplicitlyNamedNamespace');
    assert.equal(namespaces[0].description, '\n');
    assert.deepEqual(namespaces[0].warnings, []);
    assert.equal(await underliner.underline(namespaces[0].sourceRange), `
var ImplicitlyNamedNamespace = {};
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~`);

    assert.equal(
        namespaces[1].name, 'ImplicitlyNamedNamespace.NestedNamespace');
    assert.equal(namespaces[1].description, '\n');
    assert.deepEqual(namespaces[1].warnings, []);
    assert.equal(await underliner.underline(namespaces[1].sourceRange), `
ImplicitlyNamedNamespace.NestedNamespace = {
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  foo: \'bar\'
~~~~~~~~~~~~
};
~~`);
  });

  test('scans named, dynamic namespaces', async() => {
    const namespaces = await getNamespaces('namespace-dynamic-named.js');
    assert.equal(namespaces.length, 3);
    assert.containSubset(namespaces, [
      {
        name: 'DynamicNamespace.ArrayNotation',
        description: '\n',
        warnings: [],
      },
      {
        name: 'DynamicNamespace.DynamicArrayNotation',
        description: '\n',
        warnings: [],
      },
      {
        name: 'DynamicNamespace.Aliased',
        description: '\n',
        warnings: [],
      },
    ]);
    assert.deepEqual(
        await underliner.underline(namespaces.map((ns) => ns.sourceRange)), [
          `
DynamicNamespace['ArrayNotation'] = {
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
  foo: 'bar'
~~~~~~~~~~~~
};
~~`,
          `
DynamicNamespace[baz] = {
~~~~~~~~~~~~~~~~~~~~~~~~~
  foo: 'bar'
~~~~~~~~~~~~
};
~~`,
          `
aliasToNamespace = {
~~~~~~~~~~~~~~~~~~~~
  foo: 'bar'
~~~~~~~~~~~~
};
~~`,
        ]);
  });

  test('throws unnamed, dynamic namespaces', async() => {
    try {
      await getNamespaces('namespace-dynamic-unnamed.js');
      throw new Error('TEST: Error Expected!');
    } catch (err) {
      assert.match(err.message, /Unable to determine name for \@namespace/);
    }
  });

});

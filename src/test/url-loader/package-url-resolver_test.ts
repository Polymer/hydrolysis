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

import {assert} from 'chai';
import * as pathlib from 'path';
import URI from 'vscode-uri/lib';

import {FileRelativeUrl, ResolvedUrl} from '../../index';
import {PackageUrlResolver} from '../../url-loader/package-url-resolver';
import {fileRelativeUrl, noOpTag, resolvedUrl} from '../test-utils';

/**
 * On posix systems file urls look like:
 *      file:///path/to/foo
 * On windows they look like:
 *      file:///c%3A/path/to/foo
 *
 * This will produce an OS-correct file url.
 */
function rootedFileUrl(
    strings: TemplateStringsArray, ...values: any[]): ResolvedUrl {
  const root = URI.file(pathlib.resolve('/')).toString();
  const text = noOpTag(strings, ...values) as FileRelativeUrl;
  return (root + text) as ResolvedUrl;
}

const packageRoot = rootedFileUrl`1/2/`;

suite('PackageUrlResolver', function() {
  suite('resolve', () => {
    let resolver: PackageUrlResolver;
    setup(() => {
      resolver = new PackageUrlResolver({packageDir: `/1/2`});
    });
    test(`resolves file:// urls to themselves`, () => {
      const r = new PackageUrlResolver();
      assert.equal(
          r.resolve(
              fileRelativeUrl`file:///foo/bar/baz`,
              resolvedUrl`https://example.com/bar`),
          resolvedUrl`file:///foo/bar/baz`);
    });

    // test for url with host but not protocol
    test('resolves an in-package URL', () => {
      assert.equal(
          resolver.resolve(fileRelativeUrl`foo.html`, packageRoot),
          rootedFileUrl`1/2/foo.html`);
      assert.equal(
          resolver.resolve(fileRelativeUrl`/foo.html`, packageRoot),
          rootedFileUrl`1/2/foo.html`);
      assert.equal(
          resolver.resolve(fileRelativeUrl`./foo.html`, packageRoot),
          rootedFileUrl`1/2/foo.html`);
    });

    test(`resolves sibling URLs to the component dir`, () => {
      assert.equal(
          resolver.resolve(fileRelativeUrl`../foo/foo.html`, packageRoot),
          rootedFileUrl`1/2/bower_components/foo/foo.html`);

      const configured = new PackageUrlResolver(
          {componentDir: 'components', packageDir: '/1/2/'});
      assert.equal(
          configured.resolve(
              (rootedFileUrl`1/bar/bar.html`) as any as FileRelativeUrl,
              packageRoot),
          rootedFileUrl`1/2/components/bar/bar.html`);
    });

    test('resolves cousin URLs as normal', () => {
      assert.equal(
          resolver.resolve(fileRelativeUrl`../../foo/foo.html`, packageRoot),
          rootedFileUrl`foo/foo.html`);
    });

    test('passes URLs with unknown hostnames through untouched', () => {
      const r = new PackageUrlResolver();
      assert.equal(
          r.resolve(fileRelativeUrl`http://abc.xyz/foo.html`, packageRoot),
          resolvedUrl`http://abc.xyz/foo.html`);
      assert.equal(
          r.resolve(fileRelativeUrl`//abc.xyz/foo.html`, packageRoot),
          resolvedUrl`file://abc.xyz/foo.html`);
    });

    test(`resolves a URL with the right hostname`, () => {
      const resolver = new PackageUrlResolver({
        componentDir: `components`,
        hostname: `abc.xyz`,
        packageDir: `/1/2`
      });
      assert.equal(
          resolver.resolve(
              fileRelativeUrl`http://abc.xyz/foo.html`, packageRoot),
          rootedFileUrl`1/2/foo.html`);
      assert.equal(
          resolver.resolve(
              fileRelativeUrl`http://abc.xyz/./foo.html`, packageRoot),
          rootedFileUrl`1/2/foo.html`);
      assert.equal(
          resolver.resolve(
              fileRelativeUrl`http://abc.xyz/../foo.html`, packageRoot),
          rootedFileUrl`1/2/foo.html`);
      assert.equal(
          resolver.resolve(
              fileRelativeUrl`http://abc.xyz/foo/../foo.html`, packageRoot),
          rootedFileUrl`1/2/foo.html`);

      assert.equal(
          resolver.resolve(fileRelativeUrl`foo.html`, packageRoot),
          rootedFileUrl`1/2/foo.html`);
      assert.equal(
          resolver.resolve(fileRelativeUrl`./foo.html`, packageRoot),
          rootedFileUrl`1/2/foo.html`);
      assert.equal(
          resolver.resolve(fileRelativeUrl`foo/../foo.html`, packageRoot),
          rootedFileUrl`1/2/foo.html`);

      assert.equal(
          resolver.resolve(fileRelativeUrl`/foo.html`, packageRoot),
          rootedFileUrl`1/2/foo.html`);
      assert.equal(
          resolver.resolve(fileRelativeUrl`/./foo.html`, packageRoot),
          rootedFileUrl`1/2/foo.html`);
      assert.equal(
          resolver.resolve(fileRelativeUrl`/../foo/foo.html`, packageRoot),
          rootedFileUrl`1/2/foo/foo.html`);
      assert.equal(
          resolver.resolve(fileRelativeUrl`/foo/../foo.html`, packageRoot),
          rootedFileUrl`1/2/foo.html`);
    });

    test(`resolves a URL with spaces`, () => {
      assert.equal(
          resolver.resolve(fileRelativeUrl`spaced name.html`, packageRoot),
          rootedFileUrl`1/2/spaced%20name.html`);
    });

    test('resolves an undecodable URL to undefined', () => {
      assert.equal(
          resolver.resolve(fileRelativeUrl`%><><%=`, packageRoot), undefined);
    });

    test('resolves a URL with no pathname', () => {
      const foo = rootedFileUrl`1/2/foo.html?baz#bat`;
      const bar = rootedFileUrl`1/2/bar.html`;
      assert.equal(
          resolver.resolve(fileRelativeUrl``, foo),
          rootedFileUrl`1/2/foo.html?baz`);
      assert.equal(resolver.resolve(fileRelativeUrl``, bar), bar);
      assert.equal(
          resolver.resolve(fileRelativeUrl`#buz`, foo),
          rootedFileUrl`1/2/foo.html?baz#buz`);
      assert.equal(
          resolver.resolve(fileRelativeUrl`#buz`, bar),
          rootedFileUrl`1/2/bar.html#buz`);
      assert.equal(
          resolver.resolve(fileRelativeUrl`?fiz#buz`, foo),
          rootedFileUrl`1/2/foo.html?fiz#buz`);
      assert.equal(
          resolver.resolve(fileRelativeUrl`?fiz#buz`, bar),
          rootedFileUrl`1/2/bar.html?fiz#buz`);
    });
  });

  suite('relative', () => {
    // We want process.cwd so that on Windows we test Windows paths and on
    // posix we test posix paths.
    const resolver = new PackageUrlResolver({packageDir: process.cwd()});
    function relative(from: string, to: string) {
      const fromResolved = resolver.resolve(from as FileRelativeUrl)!;
      const toResolved = resolver.resolve(to as FileRelativeUrl)!;
      const result = resolver.relative(fromResolved, toResolved);

      return result;
    }

    test('can get relative urls between urls', () => {
      assert.equal(relative('/', '/'), '');
      assert.equal(relative('/', '/bar/'), 'bar/');
      assert.equal(relative('/foo/', '/foo/'), '');
      assert.equal(relative('/foo/', '/bar/'), '../bar/');
      assert.equal(relative('foo/', '/'), '../');
      assert.equal(relative('foo.html', 'foo.html'), '');
      assert.equal(relative('foo/', 'bar/'), '../bar/');
      assert.equal(relative('foo.html', 'bar.html'), 'bar.html');
      assert.equal(relative('sub/foo.html', 'bar.html'), '../bar.html');
      assert.equal(
          relative('sub1/foo.html', 'sub2/bar.html'), '../sub2/bar.html');
      assert.equal(relative('foo.html', 'sub/bar.html'), 'sub/bar.html');
      assert.equal(relative('./foo.html', './sub/bar.html'), 'sub/bar.html');
      assert.equal(relative('./foo.html', './bar.html'), 'bar.html');
      assert.equal(relative('./foo/', 'sub/bar.html'), '../sub/bar.html');
      assert.equal(relative('./foo/bonk.html', 'sub/bar/'), '../sub/bar/');
    });

    test('will keep absolute urls absolute', () => {
      assert.equal(
          relative('foo/', 'http://example.com'), 'http://example.com/');
      assert.equal(
          relative('foo/', 'https://example.com'), 'https://example.com/');
      assert.equal(
          relative('foo/', 'file://host/path/to/file'),
          'file://host/path/to/file');
    });

    test('sibling urls work properly', () => {
      // Our basedir, into our dependencies.
      assert.equal(relative('foo.html', '../bar/bar.html'), '../bar/bar.html');
      // Our subdir, into dependencies
      assert.equal(
          relative('foo/foo.html', '../bar/bar.html'), '../../bar/bar.html');
      // From one dependency to another
      assert.equal(
          relative('../foo/foo.html', '../bar/bar.html'), '../bar/bar.html');
    });
  });
});

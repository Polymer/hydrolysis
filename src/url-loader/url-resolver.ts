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

import * as path from 'path';
import {format as urlLibFormat, resolve as urlLibResolver} from 'url';

import {parseUrl} from '../core/utils';
import {PackageRelativeUrl, ScannedImport} from '../index';
import {FileRelativeUrl, ResolvedUrl} from '../model/url';

/**
 * Resolves the given URL to the concrete URL that a resource can
 * be loaded from.
 *
 * This can be useful to resolve name to paths, such as resolving 'polymer' to
 * '../polymer/polymer.html', or component paths, like '../polymer/polymer.html'
 * to '/bower_components/polymer/polymer.html'.
 */
export abstract class UrlResolver {
  /**
   * Resoves `url` to a new location.
   *
   * Returns `undefined` if the given url cannot be resolved.
   */
  abstract resolve(url: PackageRelativeUrl): ResolvedUrl|undefined;
  abstract resolve(
      url: FileRelativeUrl, baseUrl: ResolvedUrl,
      scannedImport?: ScannedImport): ResolvedUrl|undefined;

  abstract relative(to: ResolvedUrl): FileRelativeUrl;
  abstract relative(from: ResolvedUrl, to?: ResolvedUrl, kind?: string):
      FileRelativeUrl;

  protected simpleUrlResolve(
      url: FileRelativeUrl|PackageRelativeUrl,
      baseUrl: ResolvedUrl): ResolvedUrl {
    return this.brandAsResolved(urlLibResolver(baseUrl, url));
  }

  protected simpleUrlRelative(from: ResolvedUrl, to: ResolvedUrl):
      FileRelativeUrl {
    const fromUrl = parseUrl(from);
    const toUrl = parseUrl(to);
    // Return the `to` as-is if there are conflicting components which
    // prohibit calculating a relative form.
    if (typeof toUrl.protocol === 'string' &&
            fromUrl.protocol !== toUrl.protocol ||
        typeof toUrl.slashes === 'boolean' &&
            fromUrl.slashes !== toUrl.slashes ||
        typeof toUrl.host === 'string' && fromUrl.host !== toUrl.host ||
        typeof toUrl.auth === 'string' && fromUrl.auth !== toUrl.auth) {
      return this.brandAsRelative(to);
    }
    let pathname;
    const {search, hash} = toUrl;
    if (fromUrl.pathname === toUrl.pathname) {
      pathname = '';
    } else {
      const fromDir = typeof fromUrl.pathname === 'string' ?
          fromUrl.pathname.replace(/[^/]+$/, '') :
          '';
      const toDir = typeof toUrl.pathname === 'string' &&
              typeof toUrl.pathname === 'string' ?
          toUrl.pathname :
          '';
      // Note, below, the _ character is appended to the `toDir` so that paths
      // with trailing slash will retain the trailing slash in the result.
      pathname = path.posix.relative(fromDir, toDir + '_').replace(/_$/, '');
    }
    return this.brandAsRelative(urlLibFormat({pathname, search, hash}));
  }

  protected brandAsRelative(url: string): FileRelativeUrl {
    return url as FileRelativeUrl;
  }

  protected brandAsResolved(url: string): ResolvedUrl {
    return url as ResolvedUrl;
  }
}

/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
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

import * as fs from 'fs';
import * as pathlib from 'path';
import {Url, parse as parseUrl} from 'url';

import {UrlLoader} from './url-loader';


/**
 * Resolves requests via the file system.
 */
export class FSUrlLoader extends UrlLoader {
  root: string|undefined;

  constructor(root?: string) {
    super();
    this.root = root;
  }

  canLoad(url: string): boolean {
    let urlObject = parseUrl(url);
    let pathname =
        pathlib.normalize(decodeURIComponent(urlObject.pathname || ''));
    return this._isValid(urlObject, pathname);
  }

  _isValid(urlObject: Url, pathname: string) {
    return (urlObject.protocol === 'file' || !urlObject.hostname) &&
        !pathname.startsWith('../');
  }

  load(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      let filepath = this.getFilePath(url);
      fs.readFile(filepath, 'utf8', (error: Error, contents: string) => {
        if (error) {
          reject(error);
        } else {
          resolve(contents);
        }
      });
    });
  }

  getFilePath(url: string): string {
    let urlObject = parseUrl(url);
    let pathname =
        pathlib.normalize(decodeURIComponent(urlObject.pathname || ''));
    if (!this._isValid(urlObject, pathname)) {
      throw new Error(`Invalid URL ${url}`);
    }
    return this.root ? pathlib.join(this.root, pathname) : pathname;
  }

  offersCompletions() {
    return true;
  }

  async getCompletions(dirname: string) {
    const fullPath = this.getFilePath(dirname);
    const files = await new Promise<string[]>((resolve, reject) => {
      fs.readdir(fullPath, (err, files) => {
        err ? reject(err) : resolve(files);
      });
    });
    return await Promise.all(files.map(async(f) => {
      const fullPathToFile = pathlib.join(fullPath, f);
      const relativePath = pathlib.relative(this.root, fullPathToFile);
      if (await isDir(fullPathToFile)) {
        return `${relativePath}/`;
      }
      return relativePath;
    }));
  }
};

async function isDir(fullPath: string): Promise<boolean> {
  const stat = await new Promise<fs.Stats>((resolve, reject) => {
    fs.stat(fullPath, (err, stat) => err ? reject(err) : resolve(stat));
  });
  return stat.isDirectory();
}

'use strict';
/*
 * Copyright (c) 2011 RedHog (Egil Möller) <egil.moller@freecode.no>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* Basic usage:
 *
 * require("./index").require("./path/to/template.ejs")
 */

import ejs from 'ejs';
import fs from "fs";

import hooks from "../../static/js/pluginfw/hooks.js";

import path from "path";

import resolve from "resolve";

import {maxAge} from "../utils/Settings";

const templateCache = new Map();

export const info = {
  __output_stack: [],
  block_stack: [],
  file_stack: [],
  args: [], __output: undefined

};

const getCurrentFile = () => info.file_stack[info.file_stack.length - 1];

export const _init = (b, recursive) => {
  info.__output_stack.push(info.__output)
  info.__output = b
};

export const _exit = (b, recursive) => {
  info.__output =  info.__output_stack.pop();
};

export const begin_block = (name) => {
  info.block_stack.push(name);
  info.__output_stack.push(info.__output.get());
  info.__output.set('');
};

export const end_block = () => {
  const name = info.block_stack.pop();
  const renderContext = info.args[info.args.length - 1];
  const content = info.__output.get();
  info.__output.set(info.__output_stack.pop());
  const args = {content, renderContext};
  hooks.callAll(`eejsBlock_${name}`, args);
  info.__output.set(info.__output.get().concat(args.content));
};

export const required = (name, args?, mod?) => {
  if (args == null) args = {};

  let basedir = __dirname;
  let paths = [];

  if (info.file_stack.length) {
    basedir = path.dirname(getCurrentFile().path);
  }
  if (mod) {
    basedir = path.dirname(mod.filename);
    paths = mod.paths;
  }

  const ejspath = resolve.sync(name, {paths, basedir, extensions: ['.html', '.ejs']});

  args.e = exports;
  args.require = require;

  const cache = maxAge !== 0;
  const template = cache && templateCache.get(ejspath) || ejs.compile(
      '<% e._init({get: () => __output, set: (s) => { __output = s; }}); %>' +
        `${fs.readFileSync(ejspath).toString()}<% e._exit(); %>`,
      {filename: ejspath});
  if (cache) templateCache.set(ejspath, template);

  info.args.push(args);
  info.file_stack.push({path: ejspath});
  const res = template(args);
  info.file_stack.pop();
  info.args.pop();

  return res;
};
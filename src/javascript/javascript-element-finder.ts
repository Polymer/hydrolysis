/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

import * as estraverse from 'estraverse';
import * as estree from 'estree';

import {JavaScriptDocument} from './javascript-document';
import {JavaScriptEntityFinder} from './javascript-entity-finder';
import {Analyzer} from '../analyzer';
import {Descriptor, ElementDescriptor, PropertyDescriptor} from '../ast/ast';
import * as analyzeProperties from '../ast-utils/analyze-properties';
import * as astValue from '../ast-utils/ast-value';
import {
  declarationPropertyHandlers,
  PropertyHandlers} from '../ast-utils/declaration-property-handlers';
import * as docs from '../ast-utils/docs';
import * as esutil from '../ast-utils/esutil';
import {Visitor} from '../ast-utils/fluent-traverse';

export class ElementFinder implements JavaScriptEntityFinder {

  constructor(analyzer: Analyzer) {}

  async findEntities(
      document: JavaScriptDocument,
      visit: (visitor: Visitor) => Promise<void>)
      : Promise<ElementDescriptor[]> {
    let visitor = new ElementVisitor();
    await visit(visitor);
    return visitor.entities;
  }
}

class ElementVisitor implements Visitor {
  entities: ElementDescriptor[] = [];

  /**
   * The element being built during a traversal;
   */
  element: ElementDescriptor = null;
  propertyHandlers: PropertyHandlers = null;
  classDetected: boolean = false;

  enterClassDeclaration(node: estree.ClassDeclaration, parent: estree.Node) {
    this.classDetected = true;
    this.element = {
      type: 'element',
      desc: esutil.getAttachedComment(node),
      events: esutil.getEventComments(node).map(function(event) {
        return { desc: event };
      }),
      properties: [],
      behaviors: [],
      observers: []
    };
    this.propertyHandlers = declarationPropertyHandlers(this.element);
  }

  leaveClassDeclaration(node: estree.ClassDeclaration, parent: estree.Node) {
    this.element.properties.map((property) => docs.annotate(property));
    if (this.element) {
      this.entities.push(this.element);
      this.element = null;
      this.propertyHandlers = null;
    }
    this.classDetected = false;
  }

  enterAssignmentExpression(node: estree.AssignmentExpression, parent: estree.Node) {
    if (!this.element) {
      return;
    }
    const left = <estree.MemberExpression>node.left;
    if (left && left.object && left.object.type !== 'ThisExpression') {
      return;
    }
    const prop = <estree.Identifier>left.property;
    if (prop && prop.name) {
      let name = prop.name;
      if (name in this.propertyHandlers) {
        this.propertyHandlers[name](node.right);
      }
    }
  }

  enterMethodDefinition(node: estree.MethodDefinition, parent: estree.Node) {
    if (!this.element) {
      return;
    }
    let prop = <estree.Property>{
      key: node.key,
      value: node.value,
      kind: node.kind,
      method: true,
      leadingComments: node.leadingComments,
      shorthand: false,
      computed: false,
      type: 'Property'
    };
    const propDesc = <PropertyDescriptor>docs.annotate(esutil.toPropertyDescriptor(prop));
    if (prop && prop.kind === 'get' && (propDesc.name === 'behaviors' || propDesc.name === 'observers')) {
      let returnStatement = <estree.ReturnStatement>node.value.body.body[0];
      let argument = <estree.ArrayExpression>returnStatement.argument;
      if (propDesc.name === 'behaviors') {
        argument.elements.forEach((elementObject: estree.Identifier) => {
          this.element.behaviors.push(elementObject.name);
        });
      } else {
        argument.elements.forEach((elementObject: estree.Literal) => {
          this.element.observers.push({ javascriptNode: elementObject, expression: elementObject.raw });
        });
      }
    } else {
      this.element.properties.push(propDesc);
    }
  }

  enterCallExpression(node: estree.CallExpression, parent: estree.Node) {
    // When dealing with a class, enterCallExpression is called after the parsing actually starts
    if (this.classDetected) {
      return estraverse.VisitorOption.Skip;
    }

    let callee = node.callee;
    if (callee.type == 'Identifier') {
      const ident = <estree.Identifier>callee;
      if (ident.name == 'Polymer') {
        this.element = {
          type: 'element',
          desc: esutil.getAttachedComment(parent),
          events: esutil.getEventComments(parent).map( function(event) {
            return {desc: event};
          })
        };
        this.propertyHandlers = declarationPropertyHandlers(this.element);
      }
    }
  }

  leaveCallExpression(node: estree.CallExpression, parent: estree.Node) {
    let callee = node.callee;
    let args = node.arguments
    if (callee.type == 'Identifier' && args.length === 1 && args[0].type === 'ObjectExpression') {
      const ident = <estree.Identifier>callee;
      if (ident.name == 'Polymer') {
        if (this.element) {
          this.entities.push(this.element);
          this.element = null;
          this.propertyHandlers = null;
        }
      }
    }
  }

  enterObjectExpression(node: estree.ObjectExpression, parent: estree.Node) {
    // When dealing with a class, there is no single object that we can parse to retrieve all properties
    if (this.classDetected) {
      return estraverse.VisitorOption.Skip;
    }

    if (this.element && !this.element.properties) {
      this.element.properties = [];
      this.element.behaviors = [];
      this.element.observers = [];
      let getters: {[name: string]: PropertyDescriptor} = {};
      let setters: {[name: string]: PropertyDescriptor} = {};
      let definedProperties: {[name: string]: PropertyDescriptor} = {};
      for (let i = 0; i < node.properties.length; i++) {
        let prop = node.properties[i];
        let name = esutil.objectKeyToString(prop.key);
        if (!name) {
          throw {
            message: 'Cant determine name for property key.',
            location: node.loc.start
          };
        }

        if (name in this.propertyHandlers) {
          this.propertyHandlers[name](prop.value);
          continue;
        }
        let descriptor = esutil.toPropertyDescriptor(prop);
        if (descriptor.getter) {
          getters[descriptor.name] = descriptor;
        } else if (descriptor.setter) {
          setters[descriptor.name] = descriptor;
        } else {
          this.element.properties.push(esutil.toPropertyDescriptor(prop));
        }
      }
      Object.keys(getters).forEach((getter) => {
        let get = getters[getter];
        definedProperties[get.name] = get;
      });
      Object.keys(setters).forEach((setter) => {
        let set = setters[setter];
        if (!(set.name in definedProperties)) {
          definedProperties[set.name] = set;
        } else {
          definedProperties[set.name].setter = true;
        }
      });
      Object.keys(definedProperties).forEach((p) => {
        let prop = definedProperties[p];
        this.element.properties.push(prop);
      });
      return estraverse.VisitorOption.Skip;
    }
  }
}
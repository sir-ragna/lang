
var example_code = [ "(do (let x 10",
                     "     (if (> x 5)",
                     "       (print \"large\")",
                     "       (print \"small\"))))"
                    ].join('\n');

var example_code_tree = {
    type: "apply",
    args: [
        {type: "symbol", name: "do"}, // operator
        {type: "apply",
         args: [
            {type: "symbol", name: "let"}, // operator
            {type: "symbol", name: "x"},   // symbol def
            {type: "value", value: 10},  // symbol val
            {type: "apply",              // rest
             args: [
                {type: "symbol", name: "if"},
                {type: "apply",
                 args: [
                    {type: "symbol", name: ">"},
                    {type: "symbol", name: "x"},
                    {type: "value", value: 5}
                 ]},
                {type: "apply",
                 args: [
                    {type: "symbol", name: "print"},
                    {type: "value", value: "large"}
                 ]},
                {type: "apply",
                 args: [
                    {type: "symbol", name: "print"},
                    {type: "value", value: "small"}
                 ]}
             ]}
         ]}
    ]};

var expr_code = "(> x 5)";
var expr_tree = {
    type: "apply",
    args: [
        {type: "symbol", name: ">"},
        {type: "symbol", name: "x"},
        {type: "value", value: 5}
    ]
};

function parse(program) {
    program = program.trim();
    var expr = parseExpression(program);
    
    function findMatchingParen(str) {
        var counter = 0;
        var index = 1;
        while (!(str[index] === ')' &&
               counter === 0)) {
            if (str[index] === '(') {
                counter++;
            } else if (str[index] === ')') {
                counter--;
            }
            index++;
        }
        index++;        
        return index;
    }

    function parseExpression(program) {
        
        if (program[0] === '(') {
            //we are dealing with a nested expression
            program = program.slice(1) // rm '('
            var expr = {type: "apply", args: []};
            while (program[0] !== ')' && program !== ''){
                var arg = parseArg(program);
                expr.args.push(arg.expr);
                program = arg.rest.trim();
            }  
        } else {
            throw new SyntaxError("Expected '(': " + program);
        }
        return expr;
    }
    
    function parseArg(code) {
        /** Find argument, substract it from the string and
         *  build expression object.
         */
        var expr = {};
        var match = [];
        var str_lit_pat = /^"([^"]*)"/; // string literal
        var alt_str_lit_pat = /^'([^']*)'/; // alternative string literal
        var number_pat = /^-?\d+\b/; 
        var symbol_pat = /^[^\s(),]+/;
        
        if (str_lit_pat.test(code)) {
            match = str_lit_pat.exec(code);
            expr = {type: "value",
                    value: match[1]};
        } else if (alt_str_lit_pat.test(code)) {
            match = alt_str_lit_pat.exec(code);
            expr = {type: "value",
                    value: match[1]};
        } else if (number_pat.test(code)) {
            match = number_pat.exec(code)
            expr = {type: "value",
                    value: Number(match[0])};
        } else if (symbol_pat.test(code)) {
            match = symbol_pat.exec(code)
            expr = {type: "symbol",
                    name: match[0]};
        } else if (code[0] === '(') {
            match_pos = findMatchingParen(code);
            match.push(code.slice(0, match_pos));
            expr = parseExpression(match[0]);
        } else {
            throw new SyntaxError("Unexpected syntax: " + code);
        }
        var arg = {};
        arg.expr = expr
        arg.rest = code.slice(match[0].length);
        return arg;
    }
    return expr;
}

function evaluator(syntaxTree) {
    var environment = {};
    
    environment["true"] = true;
    environment["false"] = false;
    
    environment["if"] = function(args, env) {
        if (args.length !== 2 && args.length !== 3) {
            throw new SyntaxError("'if' takes 2 or 3 arguments");
        }
        
        if (evaluate(args[0], env) !== false) {
            return evaluate(args[1], env);
        } else if (args[2] !== undefined) {
            return evaluate(args[2], env);
        }
        return false; // expression given when false
    }
    
    environment["do"] = function(args, env) {
        var value = false;
        args.forEach(function(arg){
            value = evaluate(arg, env);
        });
        return value;
    }
    
    environment["def"] = function(args, env){
        if (args[0].type !== "symbol" || args[1] == undefined) {
            throw new SyntaxError("'def' expectes a symbol and a value");
        }
        var varName = args.shift().name; // first argument
        var varVal  = evaluate(args.shift(), env);
        
        env[varName] = varVal;
        
        return environment["do"](args, env);
    }
    
    environment["defn"] = function(args, env) {
        /** example: (defn times2 (args x) (do (multi x 2)))
         *  times2 being the function name
         *  (args x) telling us we expect 'times2' being called with 'x' as an argument
         *  (do ...) body of the function
         */
      
        function getFunctionArguments(argDefinitions) {
            if (argDefinitions.type !== "apply" || argDefinitions.args[0].name !== "args") {
                throw new SyntaxError("Expected an arguments definitions for: " + functionName);
            }
            return argDefinitions.args.slice(1).map(function(arg) { return arg.name; });
        }
        
        var functionName;
        var functionArguments = [];
        var functionBody;
        
        if (args[0].type !== "symbol") {
            throw new SyntaxError("'defun' expects a function name(symbol)");
        }
        
        functionName = args.shift().name;
        
        functionArguments = getFunctionArguments(args.shift());
        
        if (args[0].type !== "apply") {
            throw new SyntaxError("Expected function body");
        }
        
        functionBody = args.shift();
        
        if (functionName in environment) {
            throw new SyntaxError("Function already exists");
        }
        
        environment[functionName] = function(callingArgs, callingEnv) {
            // check if fArgs length matches function arguments
            if (functionArguments.length !== callingArgs.length) {
                throw new Error("Calling function with wrong number of arguments: " + functionName);
            }
            
            for (var i = 0; i < callingArgs.length; i++) {
                callingEnv[functionArguments[i]] = evaluate(callingArgs[i], callingEnv);
            }

            return evaluate(functionBody, callingEnv);
        }
        return functionName;
    }
    
    environment["print"] = function(args, env) {
        var value = args.map(function(arg){
            return evaluate(arg, env);
        }).reduce(function(a, b){
            return "" + a + "" + b;
        })
        console.log(value);
        return value;
    }
    
    environment["str"] = function(args, env) {
        var value = args.map(function(arg){
            return evaluate(arg, env);
        }).reduce(function(a, b){
            return "" + a + "" + b;
        })
        return value;
    }
    
    environment["or"] = function(args, env) {
        var index = 0;
        for (; index < args.length; index++) {
            if (evaluate(args[index], env) === true) {
                return true; // be lazy
            }
        }
        return false;
    };
    
    environment["and"] = function(args, env) {
        var index = 0;
        for (; index < args.length; index++) {
            if (evaluate(args[index], env) === false) {
                return false; // be lazy
            }
        }
        return true;
    }
    
    function addFunctionToEnv(name, func) {
        /** most functions except some special ones prefer getting evaluated arguments.
         * This wrapper evaluates their values before adding them to the environment.
         */
        environment[name] = function(args, env) {
            return func.apply(null, args.map(function(arg) {
                return evaluate(arg, env);
            }));
        };
    }
    
    addFunctionToEnv("add", function() {
        return Array.prototype.slice.call(arguments).reduce(function(a, b){ return a + b; });
    });
    
    addFunctionToEnv("eq", function(a, b) {
        return a === b;
    });
    
    addFunctionToEnv("gt", function(a, b) {
        return a > b;
    });
    
    addFunctionToEnv("lt", function(a, b) {
        return a < b;
    });
    
    addFunctionToEnv("min", function(a, b) {
        if (b === undefined) {
            return -a;
        }
        return a - b;
    });
    
    addFunctionToEnv("multi", function() {
        return Array.prototype.slice.call(arguments).reduce(function(a, b){ return a * b; }, 1);
    });
    
    addFunctionToEnv("inc", function(a) {
        return a + 1;
    });
    
    addFunctionToEnv("dec", function(a) {
        return a - 1;
    });
    
    function evaluate(expr, env) {
        if (env === undefined) {
            throw new Error("Environment is not defined");
        }
        
        switch(expr.type) {
            case "value":
                return expr.value;
            case "symbol":
                if (expr.name in env) {
                    return env[expr.name];
                } else {
                    throw new ReferenceError("Undefined symbol: " + expr.name);
                }
            case "apply":
                var operator = expr.args[0];
                var args = expr.args.slice(1);
             
                var func = evaluate(operator, env)
                if (typeof func !== 'function') {
                    throw new Error("Cannot apply non-function: " + func);
                }
                return func(args, env);
        }
        throw new TypeError("Unexpected");
    
    }
    return evaluate(syntaxTree, environment);
}

function run(args) {
    var output = evaluator(parse(args));
    //console.log("Program exit output: " + output);
    return output;
}

function printTree(program) {
    var tree = parse(program);
    console.log(JSON.stringify(tree));
    console.log(tree);
    return tree;
}

function assert(code, value) {
    var ret_value = run(code);
    if (ret_value === value) {
        console.log("Test Succeeded ✔️: " + code + " 👉 " + value)
    } else {
        console.error("Test Failed ❌: " + code + " 👉 " + '(' + ret_value + ') != ' + value);
    }
}

assert("(add 4 3 10)", 17);
assert("(min 10 4)", 6);
assert("(min 10 22)", -12);
assert("(eq false true)", false);
assert("(eq false false)", true);
assert("(str \"Hello \" \"World!\")", "Hello World!");
assert("(str \"Hello \" 'World!')", "Hello World!");
assert("(str 'aaaa' 'bbbb')", "aaaabbbb");
assert("(str \"a\" 'b' \"c\" 'd')", "abcd");
assert("(do (def x 10 (if (gt x 5) 'large' 'small')))", "large");
assert("(do true)", true);
assert("(do false)", false);
assert("(do (def x 3 (do x)))", 3);
assert("(def a 2 a)", 2);
assert("(or false)", false);
assert("(or true)", true);
assert("(or true false)", true);
assert("(or false false true)", true);
assert("(or false false 0 false)", false);
assert("(and false)", false);
assert("(and true)", true);
assert("(and true 1)", true);
assert("(and true 1 4)", true);
assert("(def x 1 (and true 1 x))", true);
assert("(do (defn minusTwenty (args n) (min n 20)) (minusTwenty 100))", 80);
assert("(do (defn repeat (args s i) (if (eq 1 i) s (repeat (str s s) (dec i)))) (repeat 'ab' 2))", 'abab');

//run("(print (add 4 3 10))");
//run("(print (eq false true))");
//run("(print (eq false false))");
//run("(print \"Hello \" \"World!\")");
//run(["(do (def x 10",
//     "     (if (gt x 5)",
//     "       (print \"large\")",
//     "       (print \"small\"))))"
//   ].join('\n'));
//run("(print \"Should be false: \" (or false))");
//run("(print \"Should be false: \" (or false false false))");
//run("(print \"Should be true: \" (or false false true))");
//run("(print \"Should be true: \" (or false true true))");
//run("(print \"Should be true: \" (or true false false))");
//run("(print \"Should be false: \" (and false))");
//run("(print \"Should be false: \" (and false false false))");
//run("(print \"Should be true: \" (and true true true))");
//run("(print \"Should be false: \" (and false true true))");
//run("(print \"Should be false: \" (and true true false))");
//run("(print \"Should be true: \" (and true))");
//
//run("(or (print \"This will be printed\") true (print \"but this won't be printed\"))");
//run(["(do (defn plusOne (args n) (if (lt n 200) (print (inc n)) (print \"Finished\"))","     (plusOne 100))"].join(''));

//var s = "(do (defn pprint (args s i) (if (gt 0 i)(print \"DONE\")(do (print s)(pprint s (dec i))))) (pprint \"Hello World\" 10))";
//printTree(s);
//run("(do (defn pprint (args s i) (if (gt 0 i)(print \"DONE\")(do (print s)(pprint s (dec i))))) (pprint \"Hello World\" 10))");
//run("(def i 10 (dec (dec i)))");
//console.log(JSON.stringify( parse("(do (defn pprint (args s i) (if (gt 0 i)(print \"DONE\")(do (print s)(pprint s (dec i))))) (pprint \"Hello World\" 10))")));

//var output_parser = JSON.stringify(parse(expr_code));
//var output_manual = JSON.stringify(expr_tree);
//var parsed_code = parse(example_code);
//
//
//console.log(output_parser === output_manual);
//
//console.log(JSON.stringify(parsed_code) ===
//            JSON.stringify(example_code_tree));

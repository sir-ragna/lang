
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
        var number_pat = /^\d+\b/; 
        var symbol_pat = /^[^\s(),]+/;
        
        if (str_lit_pat.test(code)) {
            match = str_lit_pat.exec(code);
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
    
    environment["let"] = function(args, env){
        if (args[0].type !== "symbol" || args[1].type !== "value") {
            throw new SyntaxError("'let' expectes a symbol and a value");
        }
        var varName = args.shift().name; // first argument
        var varVal  = evaluate(args.shift(), env);
        
        env[varName] = varVal;
        
        return environment["do"](args, env);
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
        var value = false;
        args.forEach(function(arg) {
            if (evaluate(arg, env) === true) {
                value = true;
            }
        });
        return value;
    };
        
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
    
    addFunctionToEnv("inc", function(a) {
        return a + 1;
    });
    
    addFunctionToEnv("dec", function(a) {
        return a - 1;
    });
    
    function evaluate(expr, env) {
        switch(expr.type) {
            case "value":
                return expr.value
            case "symbol":
                if (expr.name in env) {
                    return env[expr.name];
                } else {
                    throw new ReferenceError("Undefined symbol: " + expr.name);
                }
            case "apply":
                var operator = expr.args.shift();
                var args = expr.args;
                // evaluate before or inside call?
                return evaluate(operator, env)(args, env);
        }
        throw new TypeError("Unexpected");
    
    }
    return evaluate(syntaxTree, environment);
}

function run(args) {
    return evaluator(parse(args));
}

run("(print (add 4 3 10))");
run("(print (eq false true))");
run("(print (eq false false))");
run("(print \"Hello \" \"World!\")");
run(["(do (let x 10",
     "     (if (gt x 5)",
     "       (print \"large\")",
     "       (print \"small\"))))"
   ].join('\n'));

var output_parser = JSON.stringify(parse(expr_code));
var output_manual = JSON.stringify(expr_tree);
var parsed_code = parse(example_code);


console.log(output_parser === output_manual);

console.log(JSON.stringify(parsed_code) ===
            JSON.stringify(example_code_tree));

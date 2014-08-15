
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


var output_parser = JSON.stringify(parse(expr_code));
var output_manual = JSON.stringify(expr_tree);
var parsed_code = parse(example_code);

console.log(output_parser);
console.log(output_manual);
console.log(output_parser === output_manual);

console.log(JSON.stringify(parsed_code) ===
            JSON.stringify(example_code_tree));

import {parseProgram} from "@danielx/civet";

let hAST: any = await parseProgram('x := 42');
console.dir(hAST, {depth: null});

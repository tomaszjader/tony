export function compare(expected,actual){
  const rows=expected.length+1,cols=actual.length+1,d=Array.from({length:rows},()=>Array(cols).fill(0));
  for(let i=0;i<rows;i++)d[i][0]=i;for(let j=0;j<cols;j++)d[0][j]=j;
  for(let i=1;i<rows;i++)for(let j=1;j<cols;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(expected[i-1]===actual[j-1]?0:1));
  let i=expected.length,j=actual.length;const alignment=[];
  while(i||j){if(i&&j&&d[i][j]===d[i-1][j-1]+(expected[i-1]===actual[j-1]?0:1)){alignment.push({expected:expected[--i],actual:actual[--j]});}else if(i&&d[i][j]===d[i-1][j]+1){alignment.push({expected:expected[--i],actual:''});}else{alignment.push({expected:'',actual:actual[--j]});}}
  return {alignment:alignment.reverse(),match:Math.max(0,Math.round(100*(1-d.at(-1).at(-1)/Math.max(expected.length,actual.length,1))))};
}

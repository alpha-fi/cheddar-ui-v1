//----------------------------------
//------ conversions YoctoNEAR <-> Near
//----------------------------------

//BigInt scientific notation
const base1e=BigInt(10);
function b1e(n:number){return base1e**BigInt(n)};
const b1e12=b1e(12);
const b1e24=b1e(24);
const b1e18=b1e(18);

//TGas number -> U64String
export function TGas(tgas:number):string {
    return (BigInt(tgas)*b1e12).toString(); // tgas*1e12 // Note: gas is u64
  }
//NEAR amount (up-to 6 dec points) -> U128String yoctoNEAR
export function ntoy(near:number):string {
    return (BigInt(Math.round(near*1e6))*b1e18).toString(); // near*1e24 // Note: YoctoNear is u128
}

//yoctoNEAR amount -> number, rounded
/**
 * returns Near number with 5 decimal digits
 * @param {string} yoctoNEAR amount 
 */
 export function yton(yoctos:string):number {
  try {
    if (yoctos==undefined) return 0;
    const decimals=5
    const bn=BigInt(yoctos) + BigInt(0.5*10**(24-decimals)); //round 6th decimal
    const truncated = ytonFull(bn.toString()).slice(0, (decimals-24))
    return Number(truncated) 
  }
  catch (ex) {
      console.log("ERR: yton(", yoctos, ")", ex)
      return NaN;
  }
}
/**
 * returns string with a decimal point and 24 decimal places
 * @param {string} yoctoString amount in yoctos
 */
 export function ytonFull(yoctoString:string):string {
  let result = (yoctoString + "").padStart(25, "0")
  result = result.slice(0, -24) + "." + result.slice(-24)
  return result
}

//-------------------------------------
//--- conversions User-input <-> Number
//-------------------------------------
/**
 * converts a string with and commas and decimal places into a number
 * @param {string} str
 */
 export function toNumber(str:string):number {
  const result = Number(str.replace(/,/g, ""))
  if (isNaN(result)) return 0;
  return result;
}

/**
 * Formats a number in NEAR to a string with commas and 5 decimal places
 * @param {number} n 
 */
 function toStringDecSimple(n:number) {
  const decimals = 5
  const textNoDec = Math.round(n * 10**decimals).toString().padStart(decimals+1, "0");
  return textNoDec.slice(0, -decimals) + "." + textNoDec.slice(-decimals); 
}
/**
* Formats a number in NEAR to a string with commas and 5 decimal places
* @param {number} n 
*/
export function toStringDec(n:number) {
  return addCommas(toStringDecSimple(n));
}
/**
* removes extra zeroes after the decimal point
* it leaves >4,2, or none (never 3 to not confuse the international user)
* @param {number} n 
*/
export function removeDecZeroes(withDecPoint:string):string{
  let decPointPos = withDecPoint.indexOf('.')
  if (decPointPos<=0) return withDecPoint;
  let decimals = withDecPoint.length-decPointPos-1;
  while(withDecPoint.endsWith("0") && decimals-- >4) withDecPoint=withDecPoint.slice(0,-1);
  if (withDecPoint.endsWith("00")) withDecPoint=withDecPoint.slice(0,-2)
  if (withDecPoint.endsWith(".00")) withDecPoint=withDecPoint.slice(0,-3)
  return withDecPoint;
}
/**
* Formats a number in NEAR to a string with commas and 5,2, or 0 decimal places
* @param {number} n 
*/
export function toStringDecMin(n:number) {
  return addCommas(removeDecZeroes(toStringDecSimple(n)));
}
/**
 * adds commas to a string number 
 * @param {string} str 
 */
 export function addCommas(str:string) {
  let n = str.indexOf(".")
  if (n==-1) n=str.length
  n -= 4
  while (n >= 0) {
      str = str.slice(0, n + 1) + "," + str.slice(n + 1)
      n = n - 3
  }
  return str;
}


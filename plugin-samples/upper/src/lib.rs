// Sample Drupl plugin: uppercases the input buffer.
//
// Plugin ABI (drupl/wasmi v0):
//   - alloc(size: i32) -> i32                 : reserve `size` bytes in plugin memory
//   - transform(ptr: i32, len: i32) -> i64    : process input at (ptr, len);
//                                               return high32 = output ptr, low32 = output len
//
// The host writes the input into plugin memory at the alloc()'d ptr, calls
// transform, then reads the output back from plugin memory at the returned
// (ptr, len).

use std::mem::ManuallyDrop;

#[no_mangle]
pub extern "C" fn alloc(size: i32) -> i32 {
    let buf: Vec<u8> = Vec::with_capacity(size as usize);
    let mut buf = ManuallyDrop::new(buf);
    buf.as_mut_ptr() as i32
}

#[no_mangle]
pub extern "C" fn transform(input_ptr: i32, input_len: i32) -> i64 {
    let input = unsafe {
        std::slice::from_raw_parts(input_ptr as *const u8, input_len as usize)
    };
    let s = std::str::from_utf8(input).unwrap_or("");
    let out_bytes = s.to_uppercase().into_bytes();
    let len = out_bytes.len() as i64;
    let ptr = out_bytes.as_ptr() as i64;
    std::mem::forget(out_bytes);
    (ptr << 32) | (len & 0xFFFF_FFFF)
}

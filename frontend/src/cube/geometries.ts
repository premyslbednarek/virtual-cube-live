import * as THREE from "three"

// CODE COPIED FROM https://discourse.threejs.org/t/roundedrectangle-squircle/28645
// I have added the following line
//    geometry.computeVertexNormals()
// to make this geometry work with lights [https://stackoverflow.com/a/52455283]
export function roundedSquare( s: number, r: number, sm: number ) { // width, height, radius corner, smoothness
    // helper const's
	const wi = s / 2 - r;		// inner width
	const hi = s / 2 - r;		// inner height
	const ul = r / s;			// u left
	const ur = ( s - r ) / s;	// u right
	const vl = r / s;			// v low
	const vh = ( s - r ) / s;	// v high

	let positions = [

		 wi, hi, 0, -wi, hi, 0, -wi, -hi, 0, wi, -hi, 0

	];

	let uvs = [

		ur, vh, ul, vh, ul, vl, ur, vl

	];

	let n = [

		3 * ( sm + 1 ) + 3,  3 * ( sm + 1 ) + 4,  sm + 4,  sm + 5,
		2 * ( sm + 1 ) + 4,  2,  1,  2 * ( sm + 1 ) + 3,
		3,  4 * ( sm + 1 ) + 3,  4, 0

	];

	let indices = [

		n[0], n[1], n[2],  n[0], n[2],  n[3],
		n[4], n[5], n[6],  n[4], n[6],  n[7],
		n[8], n[9], n[10], n[8], n[10], n[11]

	];

	let phi, cos, sin, xc, yc, uc, vc, idx;

	for ( let i = 0; i < 4; i ++ ) {

		xc = i < 1 || i > 2 ? wi : -wi;
		yc = i < 2 ? hi : -hi;

		uc = i < 1 || i > 2 ? ur : ul;
		vc = i < 2 ? vh : vl;

		for ( let j = 0; j <= sm; j ++ ) {

			phi = Math.PI / 2  *  ( i + j / sm );
			cos = Math.cos( phi );
			sin = Math.sin( phi );

			positions.push( xc + r * cos, yc + r * sin, 0 );

			uvs.push( uc + ul * cos, vc + vl * sin );

			if ( j < sm ) {

				idx =  ( sm + 1 ) * i + j + 4;
				indices.push( i, idx, idx + 1 );

			}

		}

	}

	const geometry = new THREE.BufferGeometry( );
	geometry.setIndex( new THREE.BufferAttribute( new Uint32Array( indices ), 1 ) );
	geometry.setAttribute( 'position', new THREE.BufferAttribute( new Float32Array( positions ), 3 ) );
	geometry.setAttribute( 'uv', new THREE.BufferAttribute( new Float32Array( uvs ), 2 ) );
    geometry.computeVertexNormals()

	return geometry;

}

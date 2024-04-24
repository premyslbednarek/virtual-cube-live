import { ActionIcon, Button } from "@mantine/core";
import { IconPlayerPlay } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { print_time } from "../cube/timer";

interface SolveInfo {
    id: number,
    time: number,
    cube_size: number
}

export default function ShowSolvesToContinue({onContinue} : {onContinue: (solve_id: number) => void}) {
    const [solves, setSolves] = useState<Array<SolveInfo>>([]);

    useEffect(() => {
        fetch("/api/solves_to_continue").then(res => res.json()).then((data: {solves: Array<SolveInfo>}) => {
            setSolves(data.solves);
        }).catch(err => console.log(err));
    }, [])

    return (
        <div>
         {
            // map over reversed array - https://stackoverflow.com/a/68242111
            solves.slice(0).reverse().map(solve => (
                    <div key={solve.id}>
                        {solve.cube_size}x{solve.cube_size} Time: {print_time(solve.time)} Id: {solve.id} <ActionIcon onClick={() => onContinue(solve.id)}><IconPlayerPlay></IconPlayerPlay></ActionIcon>
                    </div>
                )
            )
         }
        </div>
    );
}
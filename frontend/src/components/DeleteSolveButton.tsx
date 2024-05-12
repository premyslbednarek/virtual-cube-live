import { Button } from "@mantine/core";
import { useState } from "react";
import { IconTrash, IconTrashOff } from "@tabler/icons-react";


export function DeleteSolveButton({ deleted, solve_id, onChange }: { solve_id: number; deleted: boolean; onChange?: (id: number, newVal: boolean) => void; }) {
    // button used in timelist and replay
    // clicking it will call api endpoint to set deletion status of given solve
    // it either deletes the solve or reverts a deletion depending on the current state
    // when the api returns success, onChange is called (used for changing)
    // the color of the solve in the timelist or will display deleted status in replay
    // mode
    const onClick = () => {
        const newStatus = !deleted;
        fetch('/api/update_solve_deleted_status', {
            method: "POST",
            body: JSON.stringify({ id: solve_id, status: newStatus })
        }).then(res => {
            if (res.status === 200) {
                onChange && onChange(solve_id, newStatus);
            }
        }).catch(err => console.log(err));
    };

    if (deleted) {
        return <Button color="green" onClick={onClick} leftSection={<IconTrashOff />}>Restore</Button>;
    }

    return <Button color="red" onClick={onClick} leftSection={<IconTrash />}>Delete </Button>;
}
